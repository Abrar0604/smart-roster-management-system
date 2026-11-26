import type {
  BackupCandidate,
  EntryStatus,
  GeneratedConflict,
  GeneratedEntry,
  SchedulerInput,
} from "@/lib/types";
import { rankBackupCandidates } from "./backup-recommender";
import { buildCalendar } from "./calendar";
import { computeDemand } from "./demand";
import { validateRoster } from "./validator";

export interface PartialRegenOptions {
  input: SchedulerInput;
  existingEntries: GeneratedEntry[];
  employeeId: string;
  targetDateKeys: string[];
  newStatus: Exclude<EntryStatus, "WORKING">;
  reason: string;
  autoAssignBackup: boolean;
}

export interface PartialRegenResult {
  updatedEntries: GeneratedEntry[];
  conflictsBefore: GeneratedConflict[];
  conflictsAfter: GeneratedConflict[];
  affectedSlots: Array<{
    dateKey: string;
    brandId: string;
    brandName: string;
    processId: string;
    processCode: string;
    remainingWorkers: number;
    requiredStaff: number;
    backupAssigned: string | null;
    candidates: BackupCandidate[];
  }>;
  preservedEntriesCount: number;
  modifiedEntriesCount: number;
}

/**
 * Handles post-generation availability changes (e.g., sudden leave or unavailability)
 * WITHOUT rebuilding unaffected employees or unaffected dates.
 */
export function applyEmployeeUnavailability(
  options: PartialRegenOptions
): PartialRegenResult {
  const {
    input,
    existingEntries,
    employeeId,
    targetDateKeys,
    newStatus,
    reason,
    autoAssignBackup,
  } = options;

  const calendar = buildCalendar(input.month, input.year, input.holidays);
  const demand = computeDemand(calendar, input.configs);
  const demandMap = new Map(
    demand.map((s) => [`${s.dateKey}::${s.brandId}::${s.processId}`, s])
  );
  const brandMap = new Map(input.brands.map((b) => [b.id, b]));
  const processMap = new Map(input.processes.map((p) => [p.id, p]));
  const employeeMap = new Map(input.employees.map((e) => [e.id, e]));

  const conflictsBefore = validateRoster(
    input,
    calendar,
    demand,
    existingEntries
  );

  // Deep-clone entries so unaffected records stay intact
  const clonedEntries: GeneratedEntry[] = existingEntries.map((e) => ({
    ...e,
    allocations: e.allocations.map((a) => ({ ...a })),
  }));
  const entryMap = new Map(
    clonedEntries.map((e) => [`${e.employeeId}::${e.dateKey}`, e])
  );

  const targetDateSet = new Set(targetDateKeys);
  let modifiedEntriesCount = 0;

  // Record which (dateKey, brandId, processId) slots this employee previously covered
  const impactedSlots: Array<{
    dateKey: string;
    brandId: string;
    processId: string;
  }> = [];

  for (const dateKey of targetDateSet) {
    const entry = entryMap.get(`${employeeId}::${dateKey}`);
    if (!entry) continue;

    // Capture current allocations AND primary assignments for that operating day
    const slotKeysSeen = new Set<string>();
    for (const alloc of entry.allocations) {
      const k = `${dateKey}::${alloc.brandId}::${alloc.processId}`;
      if (!slotKeysSeen.has(k)) {
        slotKeysSeen.add(k);
        impactedSlots.push({
          dateKey,
          brandId: alloc.brandId,
          processId: alloc.processId,
        });
      }
    }
    for (const a of input.assignments) {
      if (a.employeeId === employeeId && a.allocationType === "PRIMARY") {
        const slot = demandMap.get(`${dateKey}::${a.brandId}::${a.processId}`);
        const k = `${dateKey}::${a.brandId}::${a.processId}`;
        if (slot?.isOperatingDay && !slotKeysSeen.has(k)) {
          slotKeysSeen.add(k);
          impactedSlots.push({
            dateKey,
            brandId: a.brandId,
            processId: a.processId,
          });
        }
      }
    }

    entry.status = newStatus;
    entry.allocations = [];
    entry.isManualOverride = true;
    entry.overrideReason = reason;
    modifiedEntriesCount++;
  }

  // Evaluate remaining coverage for impacted slots and optionally activate backups
  const affectedSlots: PartialRegenResult["affectedSlots"] = [];

  for (const imp of impactedSlots) {
    const slot = demandMap.get(
      `${imp.dateKey}::${imp.brandId}::${imp.processId}`
    );
    if (!slot || !slot.isOperatingDay) continue;

    const currentWorkers = clonedEntries.filter(
      (e) =>
        e.dateKey === imp.dateKey &&
        e.status === "WORKING" &&
        e.allocations.some(
          (a) => a.brandId === imp.brandId && a.processId === imp.processId
        )
    );

    let remainingWorkers = currentWorkers.length;
    let backupAssigned: string | null = null;
    const excludeIds = new Set(currentWorkers.map((w) => w.employeeId));
    excludeIds.add(employeeId);

    const affectedEmployee = employeeMap.get(employeeId);
    const candidates = rankBackupCandidates({
      dateKey: imp.dateKey,
      brandId: imp.brandId,
      processId: imp.processId,
      brandPodId: affectedEmployee?.podId ?? null,
      shiftWindow: slot.shiftWindow,
      calendar,
      pods: input.pods,
      employees: input.employees,
      assignments: input.assignments,
      entries: entryMap,
      excludeEmployeeIds: excludeIds,
    });

    if (autoAssignBackup && remainingWorkers < slot.requiredStaff) {
      for (const cand of candidates) {
        if (remainingWorkers >= slot.requiredStaff) break;
        const candEntry = entryMap.get(`${cand.employeeId}::${imp.dateKey}`);
        if (!candEntry || candEntry.status !== "WORKING") continue;

        candEntry.allocations.push({
          brandId: imp.brandId,
          processId: imp.processId,
          shiftWindow: slot.shiftWindow,
          isBackup: true,
          capacityWeight: 0.5,
        });
        candEntry.isManualOverride = true;
        candEntry.overrideReason = `Auto-backup for ${affectedEmployee?.name ?? employeeId}`;
        remainingWorkers++;
        backupAssigned = cand.employeeName;
        modifiedEntriesCount++;
      }
    }

    affectedSlots.push({
      dateKey: imp.dateKey,
      brandId: imp.brandId,
      brandName: brandMap.get(imp.brandId)?.name ?? imp.brandId,
      processId: imp.processId,
      processCode: processMap.get(imp.processId)?.code ?? imp.processId,
      remainingWorkers,
      requiredStaff: slot.requiredStaff,
      backupAssigned,
      candidates: candidates.slice(0, 3),
    });
  }

  const conflictsAfter = validateRoster(
    input,
    calendar,
    demand,
    clonedEntries
  );

  return {
    updatedEntries: clonedEntries,
    conflictsBefore,
    conflictsAfter,
    affectedSlots,
    preservedEntriesCount: clonedEntries.length - modifiedEntriesCount,
    modifiedEntriesCount,
  };
}
