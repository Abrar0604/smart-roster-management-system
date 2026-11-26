import { prisma } from "@/lib/db";
import { buildCalendar } from "@/lib/scheduler/calendar";
import { computeDemand, parseDayOverrides } from "@/lib/scheduler/demand";
import { computeFairnessStats } from "@/lib/scheduler/fairness";
import { parseSuggestions } from "@/lib/scheduler/service";
import type {
  ConflictSuggestion,
  DomainBrandProcessConfig,
  DomainPublicHoliday,
  EntryStatus,
  GeneratedEntry,
  OperatingRule,
  ShiftWindow,
} from "@/lib/types";
import { toDateKey } from "@/lib/utils";

export async function getAllRostersSummary() {
  return prisma.roster.findMany({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    include: {
      _count: {
        select: {
          entries: true,
          conflicts: true,
        },
      },
      conflicts: {
        select: { severity: true, conflictType: true },
      },
    },
  });
}

export async function getRosterWorkspaceData(opts?: {
  rosterId?: string;
  month?: number;
  year?: number;
}) {
  const allRosters = await getAllRostersSummary();

  let targetRosterId = opts?.rosterId;
  if (!targetRosterId && opts?.month && opts?.year) {
    targetRosterId = allRosters.find(
      (r) => r.month === opts.month && r.year === opts.year
    )?.id;
  }
  if (!targetRosterId) {
    targetRosterId = allRosters[0]?.id;
  }

  const [pods, employees, brands, processes, configs, assignments, holidays] =
    await Promise.all([
      prisma.pod.findMany({
        orderBy: { name: "asc" },
        include: { lead: true },
      }),
      prisma.employee.findMany({
        orderBy: { name: "asc" },
        include: {
          pod: true,
          assignments: {
            include: { brand: true, process: true },
          },
        },
      }),
      prisma.brand.findMany({
        orderBy: { name: "asc" },
        include: {
          processConfigs: { include: { process: true } },
          assignments: { include: { employee: true, process: true } },
        },
      }),
      prisma.process.findMany({ orderBy: { code: "asc" } }),
      prisma.brandProcessConfig.findMany({
        include: { brand: true, process: true },
      }),
      prisma.assignment.findMany({
        include: { employee: true, brand: true, process: true },
      }),
      prisma.publicHoliday.findMany({ orderBy: { date: "asc" } }),
    ]);

  if (!targetRosterId) {
    return {
      roster: null,
      allRosters,
      pods,
      employees,
      brands,
      processes,
      configs,
      assignments,
      holidays,
      calendar: [],
      demand: [],
      fairnessStats: [],
      coverageStats: {
        totalDemandSlots: 0,
        coveredDemandSlots: 0,
        coveragePercent: 0,
        hardConflicts: 0,
        softConflicts: 0,
      },
      parsedConflicts: [],
    };
  }

  const roster = await prisma.roster.findUnique({
    where: { id: targetRosterId },
    include: {
      entries: {
        include: {
          employee: { include: { pod: true } },
          allocations: {
            include: { brand: true, process: true },
          },
        },
      },
      conflicts: {
        orderBy: [{ severity: "asc" }, { date: "asc" }],
        include: { brand: true, process: true, employee: true },
      },
      changeLogs: {
        orderBy: { createdAt: "desc" },
        take: 25,
      },
    },
  });

  if (!roster) {
    return {
      roster: null,
      allRosters,
      pods,
      employees,
      brands,
      processes,
      configs,
      assignments,
      holidays,
      calendar: [],
      demand: [],
      fairnessStats: [],
      coverageStats: {
        totalDemandSlots: 0,
        coveredDemandSlots: 0,
        coveragePercent: 0,
        hardConflicts: 0,
        softConflicts: 0,
      },
      parsedConflicts: [],
    };
  }

  const monthStart = new Date(Date.UTC(roster.year, roster.month - 1, 1));
  const monthEnd = new Date(Date.UTC(roster.year, roster.month, 0, 23, 59, 59));

  const domainHolidays: DomainPublicHoliday[] = holidays
    .filter((h) => h.date >= monthStart && h.date <= monthEnd)
    .map((h) => ({
      id: h.id,
      dateKey: toDateKey(h.date),
      name: h.name,
      scope: h.scope,
    }));

  const calendar = buildCalendar(roster.month, roster.year, domainHolidays);

  const domainConfigs: DomainBrandProcessConfig[] = configs.map((c) => ({
    id: c.id,
    brandId: c.brandId,
    processId: c.processId,
    operatingRule: c.operatingRule as OperatingRule,
    shiftWindow: c.shiftWindow as ShiftWindow,
    minStaff: c.minStaff,
    dayOverrides: parseDayOverrides(c.dayOverrides),
    active: c.active,
  }));

  const demand = computeDemand(calendar, domainConfigs);

  const slotCounts = new Map<string, number>();
  const domainEntries: GeneratedEntry[] = roster.entries.map((e) => {
    const dateKey = toDateKey(e.date);
    if (e.status === "WORKING") {
      for (const a of e.allocations) {
        const k = `${dateKey}::${a.brandId}::${a.processId}`;
        slotCounts.set(k, (slotCounts.get(k) ?? 0) + 1);
      }
    }
    return {
      dateKey,
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
    };
  });

  const operatingDemand = demand.filter(
    (d) => d.isOperatingDay && d.requiredStaff > 0
  );
  let coveredDemandSlots = 0;
  for (const slot of operatingDemand) {
    const k = `${slot.dateKey}::${slot.brandId}::${slot.processId}`;
    if ((slotCounts.get(k) ?? 0) >= slot.requiredStaff) {
      coveredDemandSlots++;
    }
  }

  const totalDemandSlots = operatingDemand.length;
  const coveragePercent =
    totalDemandSlots > 0
      ? Math.round((coveredDemandSlots / totalDemandSlots) * 1000) / 10
      : 100;

  const fairnessStats = computeFairnessStats(
    calendar,
    employees.map((e) => ({
      id: e.id,
      name: e.name,
      email: e.email,
      role: e.role as "AGENT" | "POD_LEAD" | "BACKUP_FLOAT",
      podId: e.podId,
      maxWeeklyWorkdays: e.maxWeeklyWorkdays,
      preferredOffDay: e.preferredOffDay,
      shiftWindow: e.shiftWindow as ShiftWindow,
      active: e.active,
    })),
    domainEntries
  );

  const parsedConflicts = roster.conflicts.map((c) => ({
    ...c,
    dateKey: toDateKey(c.date),
    parsedSuggestions: parseSuggestions(c.suggestions) as ConflictSuggestion[],
  }));

  return {
    roster,
    allRosters,
    pods,
    employees,
    brands,
    processes,
    configs,
    assignments,
    holidays,
    calendar,
    demand,
    fairnessStats,
    coverageStats: {
      totalDemandSlots,
      coveredDemandSlots,
      coveragePercent,
      hardConflicts: roster.conflicts.filter((c) => c.severity === "HARD")
        .length,
      softConflicts: roster.conflicts.filter((c) => c.severity === "SOFT")
        .length,
    },
    parsedConflicts,
  };
}
