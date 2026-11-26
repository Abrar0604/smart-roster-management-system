import type { SchedulerInput, SchedulerResult } from "@/lib/types";
import { buildCalendar } from "./calendar";
import { fillCoverage } from "./coverage";
import { computeDemand } from "./demand";
import { initializeLockedEntries } from "./supply";
import { validateRoster } from "./validator";
import { assignWeeklyOffs } from "./weekly-offs";

/**
 * Pure deterministic monthly roster generator.
 * Separates Demand (client operating rules) from Supply (employee availability),
 * assigns coverage-aware weekly offs, fills primary & backup slots, and runs
 * full validation so conflicts are never silently hidden.
 */
export function runScheduler(input: SchedulerInput): SchedulerResult {
  // Step 1: Build Calendar Grid
  const calendar = buildCalendar(input.month, input.year, input.holidays);

  // Step 2: Compute Daily Demand
  const demand = computeDemand(calendar, input.configs);
  const demandMap = new Map(
    demand.map((s) => [`${s.dateKey}::${s.brandId}::${s.processId}`, s])
  );

  // Step 3: Lock Immovable Unavailability (leaves, comp-offs, applicable holidays)
  const { entries: entryMap, lockedKeys } = initializeLockedEntries(
    calendar,
    input.employees,
    input.assignments,
    demandMap,
    input.timeOffs
  );

  // Step 4: Assign Coverage-Aware Weekly Offs
  assignWeeklyOffs({
    calendar,
    employees: input.employees,
    assignments: input.assignments,
    demandMap,
    entries: entryMap,
    lockedKeys,
  });

  // Step 5 & 6: Fill Coverage & Activate Backup Floats
  const { backupActivations } = fillCoverage({
    calendar,
    demand,
    pods: input.pods,
    employees: input.employees,
    assignments: input.assignments,
    entries: entryMap,
  });

  const entriesList = Array.from(entryMap.values());

  // Step 7: Run Pure Validation Engine
  const conflicts = validateRoster(input, calendar, demand, entriesList);

  // Compute summary coverage metrics
  const operatingDemand = demand.filter(
    (d) => d.isOperatingDay && d.requiredStaff > 0
  );
  const slotCounts = new Map<string, number>();
  for (const e of entriesList) {
    if (e.status !== "WORKING") continue;
    for (const alloc of e.allocations) {
      const k = `${e.dateKey}::${alloc.brandId}::${alloc.processId}`;
      slotCounts.set(k, (slotCounts.get(k) ?? 0) + 1);
    }
  }

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

  return {
    calendar,
    demand,
    entries: entriesList,
    conflicts,
    stats: {
      totalDemandSlots,
      coveredDemandSlots,
      coveragePercent,
      hardConflicts: conflicts.filter((c) => c.severity === "HARD").length,
      softConflicts: conflicts.filter((c) => c.severity === "SOFT").length,
      backupActivations,
    },
  };
}
