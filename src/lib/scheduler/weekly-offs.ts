import type {
  CalendarDay,
  DemandSlot,
  DomainAssignment,
  DomainEmployee,
  GeneratedEntry,
} from "@/lib/types";
import { areShiftsCompatible } from "./supply";

interface WeeklyOffParams {
  calendar: CalendarDay[];
  employees: DomainEmployee[];
  assignments: DomainAssignment[];
  demandMap: Map<string, DemandSlot>;
  entries: Map<string, GeneratedEntry>;
  lockedKeys: Set<string>;
}

/**
 * Evaluates the coverage impact of giving `emp` a weekly off on `day`.
 * Returns:
 * - uncoveredCount: demand slots left completely short even considering backups
 * - backupNeededCount: slots that would require a backup float/peer to cover
 * - totalPrimaryDemand: total operating slots this employee normally covers that day
 */
function evaluateOffDayImpact(
  emp: DomainEmployee,
  day: CalendarDay,
  empPrimaryAssignments: DomainAssignment[],
  allAssignments: DomainAssignment[],
  employees: DomainEmployee[],
  demandMap: Map<string, DemandSlot>,
  entries: Map<string, GeneratedEntry>
): {
  uncoveredCount: number;
  backupNeededCount: number;
  totalPrimaryDemand: number;
} {
  let uncoveredCount = 0;
  let backupNeededCount = 0;
  let totalPrimaryDemand = 0;

  const employeeMap = new Map(employees.map((e) => [e.id, e]));

  for (const assignment of empPrimaryAssignments) {
    const slot = demandMap.get(
      `${day.dateKey}::${assignment.brandId}::${assignment.processId}`
    );
    if (!slot || !slot.isOperatingDay || slot.requiredStaff <= 0) continue;

    totalPrimaryDemand++;

    // Count other PRIMARY employees available to work this (brand, process) on this day
    const otherWorkingPrimaries = allAssignments.filter((other) => {
      if (
        other.brandId !== assignment.brandId ||
        other.processId !== assignment.processId ||
        other.allocationType !== "PRIMARY" ||
        other.employeeId === emp.id
      ) {
        return false;
      }
      const otherEmp = employeeMap.get(other.employeeId);
      if (!otherEmp || !otherEmp.active) return false;
      const otherEntry = entries.get(`${other.employeeId}::${day.dateKey}`);
      if (!otherEntry || otherEntry.status !== "WORKING") return false;
      return areShiftsCompatible(otherEntry.shiftWindow, slot.shiftWindow);
    }).length;

    if (otherWorkingPrimaries >= slot.requiredStaff) {
      continue;
    }

    const deficit = slot.requiredStaff - otherWorkingPrimaries;

    // Check if designated BACKUP or same-pod BACKUP_FLOAT employees are available on this day
    const availableBackups = employees.filter((candidate) => {
      if (!candidate.active || candidate.id === emp.id) return false;
      const candEntry = entries.get(`${candidate.id}::${day.dateKey}`);
      if (!candEntry || candEntry.status !== "WORKING") return false;
      if (!areShiftsCompatible(candEntry.shiftWindow, slot.shiftWindow)) {
        return false;
      }
      const hasExplicitBackup = allAssignments.some(
        (a) =>
          a.employeeId === candidate.id &&
          a.brandId === assignment.brandId &&
          a.processId === assignment.processId &&
          a.allocationType === "BACKUP"
      );
      const isPodFloat =
        candidate.role === "BACKUP_FLOAT" && candidate.podId === emp.podId;
      return hasExplicitBackup || isPodFloat;
    }).length;

    if (availableBackups >= deficit) {
      backupNeededCount += deficit;
    } else {
      uncoveredCount += deficit - availableBackups;
      backupNeededCount += availableBackups;
    }
  }

  return { uncoveredCount, backupNeededCount, totalPrimaryDemand };
}

/**
 * Assigns weekly offs week-by-week while strictly prioritizing client coverage
 * over employee off-day preferences, and rotating Sunday/weekend offs fairly
 * among employees sharing a brand or process.
 */
export function assignWeeklyOffs(params: WeeklyOffParams): void {
  const { calendar, employees, assignments, demandMap, entries, lockedKeys } =
    params;

  const weekIndices = Array.from(
    new Set(calendar.map((d) => d.weekIndex))
  ).sort((a, b) => a - b);

  // Track Sunday offs per employee across weeks to balance weekend fairness
  const sundayOffCounts = new Map<string, number>();
  for (const emp of employees) {
    sundayOffCounts.set(emp.id, 0);
  }

  // Primary assignment count helps order constrained employees cleanly
  const primaryCountByEmp = new Map<string, number>();
  for (const emp of employees) {
    primaryCountByEmp.set(
      emp.id,
      assignments.filter(
        (a) => a.employeeId === emp.id && a.allocationType === "PRIMARY"
      ).length
    );
  }

  for (const weekIdx of weekIndices) {
    const weekDays = calendar.filter((d) => d.weekIndex === weekIdx);

    // Order employees: fewest Sunday offs so far, then most constrained (multi-brand / single-brand)
    const orderedEmployees = employees
      .filter((e) => e.active)
      .sort((a, b) => {
        const sunDiff =
          (sundayOffCounts.get(a.id) ?? 0) - (sundayOffCounts.get(b.id) ?? 0);
        if (sunDiff !== 0) return sunDiff;
        return (
          (primaryCountByEmp.get(b.id) ?? 0) -
          (primaryCountByEmp.get(a.id) ?? 0)
        );
      });

    for (const emp of orderedEmployees) {
      if (emp.maxWeeklyWorkdays >= 7) continue;

      const empPrimaries = assignments.filter(
        (a) => a.employeeId === emp.id && a.allocationType === "PRIMARY"
      );

      let nonWorkingCount = 0;
      for (const day of weekDays) {
        const entry = entries.get(`${emp.id}::${day.dateKey}`);
        if (entry && entry.status !== "WORKING") {
          nonWorkingCount++;
        }
      }

      const workableDays = weekDays.length - nonWorkingCount;
      const neededForMaxWork = Math.max(
        0,
        workableDays - emp.maxWeeklyWorkdays
      );
      const neededForFullWeek =
        weekDays.length >= 6 && nonWorkingCount === 0 ? 1 : 0;
      const offsToAssign = Math.max(neededForMaxWork, neededForFullWeek);

      for (let i = 0; i < offsToAssign; i++) {
        const candidates = weekDays
          .filter((day) => {
            const key = `${emp.id}::${day.dateKey}`;
            const entry = entries.get(key);
            return entry && entry.status === "WORKING" && !lockedKeys.has(key);
          })
          .map((day) => {
            const impact = evaluateOffDayImpact(
              emp,
              day,
              empPrimaries,
              assignments,
              employees,
              demandMap,
              entries
            );
            const isPreferred =
              emp.preferredOffDay !== null &&
              day.dayOfWeek === emp.preferredOffDay;
            const isSunday = day.dayOfWeek === 0;

            // Lower penalty is better. Mandatory coverage (uncoveredCount) strictly dominates preferences.
            let penalty = 0;
            penalty += impact.uncoveredCount * 10000;
            penalty += impact.backupNeededCount * 500;
            penalty += impact.totalPrimaryDemand * 50;
            if (!isPreferred && emp.preferredOffDay !== null) {
              penalty += 25;
            }
            if (!isSunday && emp.preferredOffDay === null) {
              // Slight bias toward Sunday off when brand is closed or impact is tied
              penalty += 5;
            }

            return { day, penalty, isSunday };
          })
          .sort((a, b) => a.penalty - b.penalty);

        const chosen = candidates[0];
        if (!chosen) break;

        const key = `${emp.id}::${chosen.day.dateKey}`;
        const entry = entries.get(key);
        if (entry) {
          entry.status = "WEEKLY_OFF";
          entry.allocations = [];
          if (chosen.isSunday) {
            sundayOffCounts.set(
              emp.id,
              (sundayOffCounts.get(emp.id) ?? 0) + 1
            );
          }
        }
      }
    }
  }
}
