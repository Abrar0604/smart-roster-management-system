import type {
  CalendarDay,
  DomainEmployee,
  GeneratedConflict,
  GeneratedEntry,
} from "@/lib/types";

export interface EmployeeFairnessStat {
  employeeId: string;
  employeeName: string;
  podId: string;
  totalWorkingDays: number;
  totalWeeklyOffs: number;
  sundayOffs: number;
  weekendOffs: number;
  preferredOffMatches: number;
  maxConsecutiveWorkdays: number;
}

export function computeFairnessStats(
  calendar: CalendarDay[],
  employees: DomainEmployee[],
  entries: GeneratedEntry[]
): EmployeeFairnessStat[] {
  const entryMap = new Map<string, GeneratedEntry>();
  for (const e of entries) {
    entryMap.set(`${e.employeeId}::${e.dateKey}`, e);
  }

  return employees
    .filter((emp) => emp.active)
    .map((emp) => {
      let totalWorkingDays = 0;
      let totalWeeklyOffs = 0;
      let sundayOffs = 0;
      let weekendOffs = 0;
      let preferredOffMatches = 0;
      let currentStreak = 0;
      let maxConsecutiveWorkdays = 0;

      for (const day of calendar) {
        const entry = entryMap.get(`${emp.id}::${day.dateKey}`);
        if (!entry) continue;

        if (entry.status === "WORKING") {
          totalWorkingDays++;
          currentStreak++;
          if (currentStreak > maxConsecutiveWorkdays) {
            maxConsecutiveWorkdays = currentStreak;
          }
        } else {
          currentStreak = 0;
        }

        if (entry.status === "WEEKLY_OFF") {
          totalWeeklyOffs++;
          if (day.dayOfWeek === 0) sundayOffs++;
          if (day.dayOfWeek === 0 || day.dayOfWeek === 6) weekendOffs++;
          if (
            emp.preferredOffDay !== null &&
            day.dayOfWeek === emp.preferredOffDay
          ) {
            preferredOffMatches++;
          }
        }
      }

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        podId: emp.podId,
        totalWorkingDays,
        totalWeeklyOffs,
        sundayOffs,
        weekendOffs,
        preferredOffMatches,
        maxConsecutiveWorkdays,
      };
    });
}

/**
 * Generates soft warnings if consecutive workdays exceed safe limits (e.g. > 7 across week boundaries)
 * or if weekly off counts deviate significantly within a pod.
 */
export function detectFairnessWarnings(
  calendar: CalendarDay[],
  employees: DomainEmployee[],
  entries: GeneratedEntry[]
): GeneratedConflict[] {
  const stats = computeFairnessStats(calendar, employees, entries);
  const conflicts: GeneratedConflict[] = [];
  const lastDateKey = calendar[calendar.length - 1]?.dateKey ?? "";

  for (const stat of stats) {
    if (stat.maxConsecutiveWorkdays > 7) {
      conflicts.push({
        dateKey: lastDateKey,
        brandId: null,
        processId: null,
        employeeId: stat.employeeId,
        severity: "SOFT",
        conflictType: "FAIRNESS_WARNING",
        description: `${stat.employeeName} is scheduled for ${stat.maxConsecutiveWorkdays} consecutive working days across a week boundary.`,
        suggestions: [],
      });
    }
  }

  return conflicts;
}
