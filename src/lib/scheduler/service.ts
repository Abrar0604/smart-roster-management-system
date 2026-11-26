import { prisma } from "@/lib/db";
import type {
  AllocationType,
  ConflictSuggestion,
  DomainAssignment,
  DomainBrand,
  DomainBrandProcessConfig,
  DomainEmployee,
  DomainPod,
  DomainProcess,
  DomainPublicHoliday,
  DomainTimeOff,
  EmployeeRole,
  EntryStatus,
  GeneratedEntry,
  OperatingRule,
  SchedulerInput,
  ShiftWindow,
  TimeOffStatus,
  TimeOffType,
} from "@/lib/types";
import { parseUTCDate, toDateKey } from "@/lib/utils";
import { buildCalendar } from "./calendar";
import { computeDemand, parseDayOverrides } from "./demand";
import { runScheduler } from "./engine";
import { applyEmployeeUnavailability } from "./partial-regen";
import { validateRoster } from "./validator";

/**
 * Loads all domain configuration, demand rules, and supply records from SQLite
 * for a given month/year.
 */
export async function loadSchedulerInput(
  month: number,
  year: number
): Promise<SchedulerInput> {
  const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  const [pods, employees, brands, processes, configs, assignments, timeOffs, holidays] =
    await Promise.all([
      prisma.pod.findMany({ orderBy: { name: "asc" } }),
      prisma.employee.findMany({ orderBy: { name: "asc" } }),
      prisma.brand.findMany({ orderBy: { name: "asc" } }),
      prisma.process.findMany({ orderBy: { code: "asc" } }),
      prisma.brandProcessConfig.findMany(),
      prisma.assignment.findMany(),
      prisma.timeOff.findMany({
        where: {
          date: { gte: monthStart, lte: monthEnd },
        },
      }),
      prisma.publicHoliday.findMany({
        where: {
          date: { gte: monthStart, lte: monthEnd },
        },
      }),
    ]);

  return {
    month,
    year,
    pods: pods.map((p): DomainPod => ({
      id: p.id,
      name: p.name,
      leadId: p.leadId,
    })),
    employees: employees.map((e): DomainEmployee => ({
      id: e.id,
      name: e.name,
      email: e.email,
      role: e.role as EmployeeRole,
      podId: e.podId,
      maxWeeklyWorkdays: e.maxWeeklyWorkdays,
      preferredOffDay: e.preferredOffDay,
      shiftWindow: e.shiftWindow as ShiftWindow,
      active: e.active,
    })),
    brands: brands.map((b): DomainBrand => ({
      id: b.id,
      name: b.name,
      code: b.code,
      active: b.active,
    })),
    processes: processes.map((p): DomainProcess => ({
      id: p.id,
      code: p.code,
      name: p.name,
    })),
    configs: configs.map((c): DomainBrandProcessConfig => ({
      id: c.id,
      brandId: c.brandId,
      processId: c.processId,
      operatingRule: c.operatingRule as OperatingRule,
      shiftWindow: c.shiftWindow as ShiftWindow,
      minStaff: c.minStaff,
      dayOverrides: parseDayOverrides(c.dayOverrides),
      active: c.active,
    })),
    assignments: assignments.map((a): DomainAssignment => ({
      id: a.id,
      employeeId: a.employeeId,
      brandId: a.brandId,
      processId: a.processId,
      allocationType: a.allocationType as AllocationType,
      shiftWindow: a.shiftWindow as ShiftWindow,
      capacityWeight: a.capacityWeight,
      priority: a.priority,
    })),
    timeOffs: timeOffs.map((t): DomainTimeOff => ({
      id: t.id,
      employeeId: t.employeeId,
      dateKey: toDateKey(t.date),
      type: t.type as TimeOffType,
      status: t.status as TimeOffStatus,
      reason: t.reason,
    })),
    holidays: holidays.map((h): DomainPublicHoliday => ({
      id: h.id,
      dateKey: toDateKey(h.date),
      name: h.name,
      scope: h.scope,
    })),
  };
}

/**
 * Persists a freshly generated roster (replacing any prior roster for that month/year).
 */
export async function generateAndSaveRoster(month: number, year: number) {
  const input = await loadSchedulerInput(month, year);
  const result = runScheduler(input);

  // Remove any existing roster for (month, year) cleanly
  await prisma.roster.deleteMany({
    where: { month, year },
  });

  const roster = await prisma.roster.create({
    data: {
      month,
      year,
      status: "DRAFT",
      entries: {
        create: [],
      },
    },
  });

  // Bulk insert entries
  await prisma.rosterEntry.createMany({
    data: result.entries.map((e) => ({
      rosterId: roster.id,
      date: parseUTCDate(e.dateKey),
      employeeId: e.employeeId,
      status: e.status,
      shiftWindow: e.shiftWindow,
      isManualOverride: e.isManualOverride,
      overrideReason: e.overrideReason,
    })),
  });

  // Fetch inserted entries to map IDs for child allocations
  const savedEntries = await prisma.rosterEntry.findMany({
    where: { rosterId: roster.id },
    select: { id: true, employeeId: true, date: true },
  });
  const entryIdMap = new Map(
    savedEntries.map((e) => [`${e.employeeId}::${toDateKey(e.date)}`, e.id])
  );

  const allocationRows: Array<{
    rosterEntryId: string;
    brandId: string;
    processId: string;
    shiftWindow: string;
    isBackup: boolean;
    capacityWeight: number;
  }> = [];

  for (const e of result.entries) {
    const entryId = entryIdMap.get(`${e.employeeId}::${e.dateKey}`);
    if (!entryId) continue;
    for (const a of e.allocations) {
      allocationRows.push({
        rosterEntryId: entryId,
        brandId: a.brandId,
        processId: a.processId,
        shiftWindow: a.shiftWindow,
        isBackup: a.isBackup,
        capacityWeight: a.capacityWeight,
      });
    }
  }

  if (allocationRows.length > 0) {
    await prisma.rosterAllocation.createMany({ data: allocationRows });
  }

  if (result.conflicts.length > 0) {
    await prisma.rosterConflict.createMany({
      data: result.conflicts.map((c) => ({
        rosterId: roster.id,
        date: parseUTCDate(c.dateKey),
        brandId: c.brandId,
        processId: c.processId,
        employeeId: c.employeeId,
        severity: c.severity,
        conflictType: c.conflictType,
        description: c.description,
        suggestions: JSON.stringify(c.suggestions),
        resolved: false,
      })),
    });
  }

  await prisma.rosterChangeLog.create({
    data: {
      rosterId: roster.id,
      actionType: "GENERATED",
      summary: `Generated roster for ${year}-${String(month).padStart(2, "0")}: ${result.stats.coveredDemandSlots}/${result.stats.totalDemandSlots} slots covered (${result.stats.coveragePercent}%), ${result.stats.hardConflicts} hard & ${result.stats.softConflicts} soft conflicts.`,
      details: JSON.stringify(result.stats),
    },
  });

  return { rosterId: roster.id, ...result };
}

/**
 * Reads an existing DB roster back into pure domain GeneratedEntry[] and re-runs
 * validateRoster(), updating RosterConflict records in place.
 */
export async function revalidateRosterInDb(rosterId: string) {
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    include: {
      entries: {
        include: { allocations: true },
      },
    },
  });

  if (!roster) {
    throw new Error("Roster not found");
  }

  const input = await loadSchedulerInput(roster.month, roster.year);
  const calendar = buildCalendar(roster.month, roster.year, input.holidays);
  const demand = computeDemand(calendar, input.configs);

  const entries: GeneratedEntry[] = roster.entries.map((e) => ({
    dateKey: toDateKey(e.date),
    employeeId: e.employeeId,
    status: e.status as EntryStatus,
    shiftWindow: e.shiftWindow as ShiftWindow,
    isManualOverride: e.isManualOverride,
    overrideReason: e.overrideReason,
    allocations: e.allocations.map((a) => ({
      brandId: a.brandId,
      processId: a.processId,
      shiftWindow: a.shiftWindow as ShiftWindow,
      isBackup: a.isBackup,
      capacityWeight: a.capacityWeight,
    })),
  }));

  const conflicts = validateRoster(input, calendar, demand, entries);

  await prisma.rosterConflict.deleteMany({ where: { rosterId } });

  if (conflicts.length > 0) {
    await prisma.rosterConflict.createMany({
      data: conflicts.map((c) => ({
        rosterId,
        date: parseUTCDate(c.dateKey),
        brandId: c.brandId,
        processId: c.processId,
        employeeId: c.employeeId,
        severity: c.severity,
        conflictType: c.conflictType,
        description: c.description,
        suggestions: JSON.stringify(c.suggestions),
        resolved: false,
      })),
    });
  }

  return conflicts;
}

/**
 * Updates a single employee-date entry (status + allocations) and revalidates live.
 */
export async function updateRosterEntryAndValidate(params: {
  rosterId: string;
  entryId: string;
  status: EntryStatus;
  shiftWindow?: ShiftWindow;
  overrideReason?: string | null;
  allocations?: Array<{
    brandId: string;
    processId: string;
    shiftWindow?: ShiftWindow;
    isBackup?: boolean;
    capacityWeight?: number;
  }>;
}) {
  const existing = await prisma.rosterEntry.findUnique({
    where: { id: params.entryId },
    include: { employee: true, allocations: true },
  });
  if (!existing || existing.rosterId !== params.rosterId) {
    throw new Error("Roster entry not found");
  }

  await prisma.rosterAllocation.deleteMany({
    where: { rosterEntryId: existing.id },
  });

  await prisma.rosterEntry.update({
    where: { id: existing.id },
    data: {
      status: params.status,
      shiftWindow: params.shiftWindow ?? existing.shiftWindow,
      isManualOverride: true,
      overrideReason: params.overrideReason ?? "Manual schedule edit",
    },
  });

  if (params.status === "WORKING") {
    let allocsToInsert = params.allocations;
    if (!allocsToInsert) {
      // Restore primary assignments when toggled back to WORKING
      const primaries = await prisma.assignment.findMany({
        where: {
          employeeId: existing.employeeId,
          allocationType: "PRIMARY",
        },
      });
      allocsToInsert = primaries.map((p) => ({
        brandId: p.brandId,
        processId: p.processId,
        shiftWindow: p.shiftWindow as ShiftWindow,
        isBackup: false,
        capacityWeight: p.capacityWeight,
      }));
    }

    if (allocsToInsert.length > 0) {
      await prisma.rosterAllocation.createMany({
        data: allocsToInsert.map((a) => ({
          rosterEntryId: existing.id,
          brandId: a.brandId,
          processId: a.processId,
          shiftWindow: a.shiftWindow ?? existing.shiftWindow,
          isBackup: Boolean(a.isBackup),
          capacityWeight: a.capacityWeight ?? 1.0,
        })),
      });
    }
  }

  const conflicts = await revalidateRosterInDb(params.rosterId);

  await prisma.rosterChangeLog.create({
    data: {
      rosterId: params.rosterId,
      actionType: "MANUAL_EDIT",
      summary: `Updated ${existing.employee.name} on ${toDateKey(existing.date)} from ${existing.status} to ${params.status}.`,
      details: params.overrideReason ?? null,
    },
  });

  return conflicts;
}

/**
 * Applies a post-generation employee unavailability change in DB without rebuilding the whole roster.
 */
export async function applyUnavailabilityChangeInDb(params: {
  rosterId: string;
  employeeId: string;
  dateKeys: string[];
  newStatus: Exclude<EntryStatus, "WORKING">;
  reason: string;
  autoAssignBackup: boolean;
}) {
  const roster = await prisma.roster.findUnique({
    where: { id: params.rosterId },
    include: {
      entries: {
        include: { allocations: true },
      },
    },
  });
  if (!roster) throw new Error("Roster not found");

  const input = await loadSchedulerInput(roster.month, roster.year);
  const existingEntries: GeneratedEntry[] = roster.entries.map((e) => ({
    dateKey: toDateKey(e.date),
    employeeId: e.employeeId,
    status: e.status as EntryStatus,
    shiftWindow: e.shiftWindow as ShiftWindow,
    isManualOverride: e.isManualOverride,
    overrideReason: e.overrideReason,
    allocations: e.allocations.map((a) => ({
      brandId: a.brandId,
      processId: a.processId,
      shiftWindow: a.shiftWindow as ShiftWindow,
      isBackup: a.isBackup,
      capacityWeight: a.capacityWeight,
    })),
  }));

  const result = applyEmployeeUnavailability({
    input,
    existingEntries,
    employeeId: params.employeeId,
    targetDateKeys: params.dateKeys,
    newStatus: params.newStatus,
    reason: params.reason,
    autoAssignBackup: params.autoAssignBackup,
  });

  // Persist ONLY modified entries & their allocations
  const dbEntryByKey = new Map(
    roster.entries.map((e) => [`${e.employeeId}::${toDateKey(e.date)}`, e])
  );

  for (const updated of result.updatedEntries) {
    const dbEntry = dbEntryByKey.get(`${updated.employeeId}::${updated.dateKey}`);
    if (!dbEntry) continue;

    const changedStatus = dbEntry.status !== updated.status;
    const changedAllocCount =
      dbEntry.allocations.length !== updated.allocations.length;
    const changedAllocContent =
      changedAllocCount ||
      updated.allocations.some(
        (ua, idx) =>
          dbEntry.allocations[idx]?.brandId !== ua.brandId ||
          dbEntry.allocations[idx]?.processId !== ua.processId ||
          dbEntry.allocations[idx]?.isBackup !== ua.isBackup
      );

    if (changedStatus || changedAllocContent) {
      await prisma.rosterAllocation.deleteMany({
        where: { rosterEntryId: dbEntry.id },
      });
      await prisma.rosterEntry.update({
        where: { id: dbEntry.id },
        data: {
          status: updated.status,
          isManualOverride: updated.isManualOverride,
          overrideReason: updated.overrideReason,
        },
      });
      if (updated.allocations.length > 0) {
        await prisma.rosterAllocation.createMany({
          data: updated.allocations.map((a) => ({
            rosterEntryId: dbEntry.id,
            brandId: a.brandId,
            processId: a.processId,
            shiftWindow: a.shiftWindow,
            isBackup: a.isBackup,
            capacityWeight: a.capacityWeight,
          })),
        });
      }
    }
  }

  await prisma.rosterConflict.deleteMany({
    where: { rosterId: params.rosterId },
  });
  if (result.conflictsAfter.length > 0) {
    await prisma.rosterConflict.createMany({
      data: result.conflictsAfter.map((c) => ({
        rosterId: params.rosterId,
        date: parseUTCDate(c.dateKey),
        brandId: c.brandId,
        processId: c.processId,
        employeeId: c.employeeId,
        severity: c.severity,
        conflictType: c.conflictType,
        description: c.description,
        suggestions: JSON.stringify(c.suggestions),
        resolved: false,
      })),
    });
  }

  const emp = input.employees.find((e) => e.id === params.employeeId);
  await prisma.rosterChangeLog.create({
    data: {
      rosterId: params.rosterId,
      actionType: params.autoAssignBackup ? "PARTIAL_REGEN" : "LEAVE_IMPACT",
      summary: `Marked ${emp?.name ?? params.employeeId} as ${params.newStatus} on ${params.dateKeys.join(", ")} (${result.preservedEntriesCount} unaffected cells preserved, ${result.modifiedEntriesCount} updated).`,
      details: params.reason,
    },
  });

  return result;
}

/**
 * Accepts a suggested backup candidate for a specific conflict/slot in DB.
 */
export async function assignBackupSuggestionInDb(params: {
  rosterId: string;
  dateKey: string;
  employeeId: string;
  brandId: string;
  processId: string;
}) {
  const date = parseUTCDate(params.dateKey);
  const entry = await prisma.rosterEntry.findUnique({
    where: {
      rosterId_date_employeeId: {
        rosterId: params.rosterId,
        date,
        employeeId: params.employeeId,
      },
    },
    include: { employee: true, allocations: true },
  });

  if (!entry) throw new Error("Backup employee roster entry not found");

  const config = await prisma.brandProcessConfig.findUnique({
    where: {
      brandId_processId: {
        brandId: params.brandId,
        processId: params.processId,
      },
    },
  });

  await prisma.rosterEntry.update({
    where: { id: entry.id },
    data: {
      status: "WORKING",
      isManualOverride: true,
      overrideReason: "Assigned as backup coverage",
    },
  });

  const exists = entry.allocations.some(
    (a) => a.brandId === params.brandId && a.processId === params.processId
  );
  if (!exists) {
    await prisma.rosterAllocation.create({
      data: {
        rosterEntryId: entry.id,
        brandId: params.brandId,
        processId: params.processId,
        shiftWindow: config?.shiftWindow ?? entry.shiftWindow,
        isBackup: true,
        capacityWeight: 0.5,
      },
    });
  }

  const conflicts = await revalidateRosterInDb(params.rosterId);
  await prisma.rosterChangeLog.create({
    data: {
      rosterId: params.rosterId,
      actionType: "BACKUP_ASSIGNED",
      summary: `Assigned ${entry.employee.name} as backup on ${params.dateKey}.`,
    },
  });

  return conflicts;
}

export function parseSuggestions(raw: string | null): ConflictSuggestion[] {
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ConflictSuggestion[];
  } catch {
    return [];
  }
}
