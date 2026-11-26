import type {
  CalendarDay,
  DemandSlot,
  DomainAssignment,
  DomainEmployee,
  DomainPod,
  GeneratedEntry,
} from "@/lib/types";
import { rankBackupCandidates } from "./backup-recommender";
import { areShiftsCompatible } from "./supply";

interface FillCoverageParams {
  calendar: CalendarDay[];
  demand: DemandSlot[];
  pods: DomainPod[];
  employees: DomainEmployee[];
  assignments: DomainAssignment[];
  entries: Map<string, GeneratedEntry>;
  brandPodMap?: Map<string, string | null>;
}

/**
 * Matches available WORKING employees to active DemandSlots.
 * Step 5: Assigns PRIMARY resources.
 * Step 6: Activates designated BACKUP resources or same-pod BACKUP_FLOATs
 * whenever primary availability falls short of requiredStaff.
 */
export function fillCoverage(params: FillCoverageParams): {
  backupActivations: number;
} {
  const {
    calendar,
    demand,
    pods,
    employees,
    assignments,
    entries,
    brandPodMap,
  } = params;

  const employeeMap = new Map(employees.map((e) => [e.id, e]));
  let backupActivations = 0;

  for (const slot of demand) {
    if (!slot.isOperatingDay || slot.requiredStaff <= 0) continue;

    const allocatedEmployeeIds = new Set<string>();

    // Step 5: Assign all available PRIMARY resources for this (brand, process)
    const primaryAssignments = assignments
      .filter(
        (a) =>
          a.brandId === slot.brandId &&
          a.processId === slot.processId &&
          a.allocationType === "PRIMARY"
      )
      .sort((a, b) => a.priority - b.priority);

    for (const assignment of primaryAssignments) {
      const emp = employeeMap.get(assignment.employeeId);
      if (!emp || !emp.active) continue;

      const entry = entries.get(`${emp.id}::${slot.dateKey}`);
      if (!entry || entry.status !== "WORKING") continue;

      const shiftToUse =
        assignment.shiftWindow !== "STANDARD"
          ? assignment.shiftWindow
          : slot.shiftWindow;

      const shiftOk =
        areShiftsCompatible(entry.shiftWindow, shiftToUse) &&
        entry.allocations.every((al) =>
          areShiftsCompatible(al.shiftWindow, shiftToUse)
        );
      if (!shiftOk) continue;

      entry.allocations.push({
        brandId: slot.brandId,
        processId: slot.processId,
        shiftWindow: shiftToUse,
        isBackup: false,
        capacityWeight: assignment.capacityWeight,
      });
      allocatedEmployeeIds.add(emp.id);
    }

    // Step 6: Activate backups if allocated headcount < requiredStaff
    if (allocatedEmployeeIds.size < slot.requiredStaff) {
      // Determine pod affinity from primary assignments or optional brandPodMap
      const inferredPodId =
        brandPodMap?.get(slot.brandId) ??
        (() => {
          const firstPrimary = primaryAssignments[0];
          return firstPrimary
            ? (employeeMap.get(firstPrimary.employeeId)?.podId ?? null)
            : null;
        })();

      const candidates = rankBackupCandidates({
        dateKey: slot.dateKey,
        brandId: slot.brandId,
        processId: slot.processId,
        brandPodId: inferredPodId,
        shiftWindow: slot.shiftWindow,
        calendar,
        pods,
        employees,
        assignments,
        entries,
        excludeEmployeeIds: allocatedEmployeeIds,
      });

      for (const candidate of candidates) {
        if (allocatedEmployeeIds.size >= slot.requiredStaff) break;
        const emp = employeeMap.get(candidate.employeeId);
        if (!emp) continue;
        // Never violate maxWeeklyWorkdays automatically unless explicitly assigned
        if (candidate.currentWeekWorkdays >= emp.maxWeeklyWorkdays && !candidate.isExplicitBackup) {
          continue;
        }

        const entry = entries.get(`${candidate.employeeId}::${slot.dateKey}`);
        if (!entry) continue;
        if (entry.status !== "WORKING") continue;

        entry.allocations.push({
          brandId: slot.brandId,
          processId: slot.processId,
          shiftWindow: slot.shiftWindow,
          isBackup: true,
          capacityWeight: 0.5,
        });
        allocatedEmployeeIds.add(candidate.employeeId);
        backupActivations++;
      }
    }
  }

  return { backupActivations };
}
