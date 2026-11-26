import type {
  BackupCandidate,
  CalendarDay,
  DomainAssignment,
  DomainEmployee,
  DomainPod,
  GeneratedEntry,
  ShiftWindow,
} from "@/lib/types";
import { areShiftsCompatible } from "./supply";

interface RankBackupParams {
  dateKey: string;
  brandId: string;
  processId: string;
  brandPodId: string | null;
  shiftWindow: ShiftWindow;
  calendar: CalendarDay[];
  pods: DomainPod[];
  employees: DomainEmployee[];
  assignments: DomainAssignment[];
  entries: Map<string, GeneratedEntry>;
  excludeEmployeeIds?: Set<string>;
}

/**
 * Ranks eligible backup employees when a brand/process lacks sufficient coverage.
 * Scoring prioritizes explicit backup assignments, same-pod proximity, process familiarity,
 * backup-float role, and balanced weekly workload.
 */
export function rankBackupCandidates(
  params: RankBackupParams
): BackupCandidate[] {
  const {
    dateKey,
    brandId,
    processId,
    brandPodId,
    shiftWindow,
    calendar,
    pods,
    employees,
    assignments,
    entries,
    excludeEmployeeIds,
  } = params;

  const targetDay = calendar.find((d) => d.dateKey === dateKey);
  const weekDays = targetDay
    ? calendar.filter((d) => d.weekIndex === targetDay.weekIndex)
    : [];
  const podNameMap = new Map(pods.map((p) => [p.id, p.name]));

  const candidates: BackupCandidate[] = [];

  for (const emp of employees) {
    if (!emp.active) continue;
    if (excludeEmployeeIds?.has(emp.id)) continue;

    const entry = entries.get(`${emp.id}::${dateKey}`);
    if (!entry) continue;

    // Must not be on approved leave, comp-off, or unavailable
    const isAvailableOnDate =
      entry.status === "WORKING" || entry.status === "PUBLIC_HOLIDAY";
    if (!isAvailableOnDate) continue;

    if (!areShiftsCompatible(emp.shiftWindow, shiftWindow)) continue;

    const currentDailyLoad = entry.allocations.reduce(
      (sum, a) => sum + a.capacityWeight,
      0
    );
    // Avoid extreme over-allocation (>1.5 FTE load)
    if (currentDailyLoad >= 1.5) continue;

    const empAssignments = assignments.filter((a) => a.employeeId === emp.id);
    const isExplicitBackup = empAssignments.some(
      (a) =>
        a.brandId === brandId &&
        a.processId === processId &&
        a.allocationType === "BACKUP"
    );
    const alreadyPrimary = empAssignments.some(
      (a) =>
        a.brandId === brandId &&
        a.processId === processId &&
        a.allocationType === "PRIMARY"
    );
    if (alreadyPrimary) continue;

    const processTrained = empAssignments.some((a) => a.processId === processId);
    const samePod = brandPodId ? emp.podId === brandPodId : false;

    const currentWeekWorkdays = weekDays.filter((d) => {
      const e = entries.get(`${emp.id}::${d.dateKey}`);
      return e?.status === "WORKING";
    }).length;

    let score = 0;
    const matchReasons: string[] = [];

    if (isExplicitBackup) {
      score += 50;
      matchReasons.push("Designated brand backup");
    }
    if (emp.role === "BACKUP_FLOAT") {
      score += 35;
      matchReasons.push("Dedicated backup float");
    }
    if (processTrained) {
      score += 25;
      matchReasons.push("Trained on same process");
    }
    if (samePod) {
      score += 15;
      matchReasons.push("Same operational pod");
    }
    if (entry.allocations.length === 0) {
      score += 20;
      matchReasons.push("Zero primary load on this day");
    } else {
      score -= Math.round(currentDailyLoad * 15);
      matchReasons.push(
        `Current daily load: ${currentDailyLoad.toFixed(1)} FTE`
      );
    }

    if (currentWeekWorkdays >= emp.maxWeeklyWorkdays) {
      score -= 25;
    }

    if (score > 0 || emp.role === "BACKUP_FLOAT" || processTrained) {
      candidates.push({
        employeeId: emp.id,
        employeeName: emp.name,
        podId: emp.podId,
        podName: podNameMap.get(emp.podId),
        role: emp.role,
        score,
        matchReasons,
        currentWeekWorkdays,
        isExplicitBackup,
        samePod,
        processTrained,
        isAvailableOnDate,
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}
