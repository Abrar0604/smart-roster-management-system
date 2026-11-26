import type {
  CalendarDay,
  ConflictSuggestion,
  DemandSlot,
  GeneratedConflict,
  GeneratedEntry,
  SchedulerInput,
} from "@/lib/types";
import { DAY_NAMES } from "@/lib/utils";
import { rankBackupCandidates } from "./backup-recommender";
import { detectFairnessWarnings } from "./fairness";
import { areShiftsCompatible, buildTimeOffLookup } from "./supply";

/**
 * Pure validation engine that audits any roster (auto-generated or manually edited)
 * against all mandatory (HARD) constraints and preference/fairness (SOFT) constraints.
 */
export function validateRoster(
  input: SchedulerInput,
  calendar: CalendarDay[],
  demand: DemandSlot[],
  entriesList: GeneratedEntry[]
): GeneratedConflict[] {
  const conflicts: GeneratedConflict[] = [];

  const brandMap = new Map(input.brands.map((b) => [b.id, b]));
  const processMap = new Map(input.processes.map((p) => [p.id, p]));
  const employeeMap = new Map(input.employees.map((e) => [e.id, e]));
  const timeOffLookup = buildTimeOffLookup(input.timeOffs);

  const entryMap = new Map<string, GeneratedEntry>();
  for (const e of entriesList) {
    entryMap.set(`${e.employeeId}::${e.dateKey}`, e);
  }

  // Index allocations by (dateKey, brandId, processId)
  const slotWorkersMap = new Map<string, GeneratedEntry[]>();
  for (const entry of entriesList) {
    if (entry.status !== "WORKING") continue;
    for (const alloc of entry.allocations) {
      const slotKey = `${entry.dateKey}::${alloc.brandId}::${alloc.processId}`;
      const arr = slotWorkersMap.get(slotKey) ?? [];
      arr.push(entry);
      slotWorkersMap.set(slotKey, arr);
    }
  }

  // Track uncovered/understaffed slots per brand per day for cascading-gap detection
  const brandGapByDate = new Map<string, Set<string>>();

  // 1 & 2. Coverage checks: UNCOVERED & UNDERSTAFFED
  for (const slot of demand) {
    if (!slot.isOperatingDay || slot.requiredStaff <= 0) continue;

    const slotKey = `${slot.dateKey}::${slot.brandId}::${slot.processId}`;
    const workers = slotWorkersMap.get(slotKey) ?? [];

    if (workers.length < slot.requiredStaff) {
      const brand = brandMap.get(slot.brandId);
      const proc = processMap.get(slot.processId);
      const brandLabel = brand ? `${brand.name} (${brand.code})` : slot.brandId;
      const procLabel = proc ? proc.code : slot.processId;

      const primaryAssigned = input.assignments.filter(
        (a) =>
          a.brandId === slot.brandId &&
          a.processId === slot.processId &&
          a.allocationType === "PRIMARY"
      );
      const inferredPodId =
        primaryAssigned.length > 0
          ? (employeeMap.get(primaryAssigned[0].employeeId)?.podId ?? null)
          : null;

      const excludeIds = new Set(workers.map((w) => w.employeeId));
      const backupCandidates = rankBackupCandidates({
        dateKey: slot.dateKey,
        brandId: slot.brandId,
        processId: slot.processId,
        brandPodId: inferredPodId,
        shiftWindow: slot.shiftWindow,
        calendar,
        pods: input.pods,
        employees: input.employees,
        assignments: input.assignments,
        entries: entryMap,
        excludeEmployeeIds: excludeIds,
      }).slice(0, 3);

      const suggestions: ConflictSuggestion[] = backupCandidates.map((cand) => ({
        type: "ASSIGN_BACKUP",
        employeeId: cand.employeeId,
        employeeName: cand.employeeName,
        brandId: slot.brandId,
        processId: slot.processId,
        score: cand.score,
        label: `Assign ${cand.employeeName} as backup`,
        reason: cand.matchReasons.join(" • "),
      }));

      const absentPrimaries = primaryAssigned
        .map((a) => {
          const emp = employeeMap.get(a.employeeId);
          const empEntry = entryMap.get(`${a.employeeId}::${slot.dateKey}`);
          if (!emp) return null;
          return `${emp.name} (${empEntry?.status ?? "UNASSIGNED"})`;
        })
        .filter(Boolean);

      const primaryContext =
        absentPrimaries.length > 0
          ? ` Assigned primary: ${absentPrimaries.join(", ")}.`
          : " No primary employee assigned.";

      const isUncovered = workers.length === 0;
      conflicts.push({
        dateKey: slot.dateKey,
        brandId: slot.brandId,
        processId: slot.processId,
        employeeId: primaryAssigned[0]?.employeeId ?? null,
        severity: "HARD",
        conflictType: isUncovered ? "UNCOVERED" : "UNDERSTAFFED",
        description: isUncovered
          ? `${brandLabel} — ${procLabel} has 0/${slot.requiredStaff} staff on ${slot.dateKey}.${primaryContext}`
          : `${brandLabel} — ${procLabel} is understaffed (${workers.length}/${slot.requiredStaff}) on ${slot.dateKey}.${primaryContext}`,
        suggestions,
      });

      const dateGaps = brandGapByDate.get(slot.dateKey) ?? new Set<string>();
      dateGaps.add(slot.brandId);
      brandGapByDate.set(slot.dateKey, dateGaps);
    }
  }

  // 3 & 4. Employee-level checks: LEAVE_CLASH, INCOMPATIBLE_SHIFT, DOUBLE_BOOKED
  for (const entry of entriesList) {
    const emp = employeeMap.get(entry.employeeId);
    if (!emp || !emp.active) continue;

    const approvedTimeOff = timeOffLookup.get(
      `${entry.employeeId}::${entry.dateKey}`
    );
    if (approvedTimeOff && entry.status === "WORKING") {
      conflicts.push({
        dateKey: entry.dateKey,
        brandId: entry.allocations[0]?.brandId ?? null,
        processId: entry.allocations[0]?.processId ?? null,
        employeeId: emp.id,
        severity: "HARD",
        conflictType: "LEAVE_CLASH",
        description: `${emp.name} is scheduled WORKING on ${entry.dateKey} despite approved ${approvedTimeOff.type.replace("_", " ").toLowerCase()}.`,
        suggestions: [],
      });
    }

    if (entry.status === "WORKING" && entry.allocations.length > 0) {
      // Shift compatibility check across allocations & employee's shift window
      const incompatibleShift = entry.allocations.some((alloc, idx) => {
        if (!areShiftsCompatible(emp.shiftWindow, alloc.shiftWindow)) {
          return true;
        }
        return entry.allocations
          .slice(idx + 1)
          .some((other) => !areShiftsCompatible(alloc.shiftWindow, other.shiftWindow));
      });

      if (incompatibleShift) {
        const shiftList = Array.from(
          new Set(entry.allocations.map((a) => a.shiftWindow))
        ).join(", ");
        conflicts.push({
          dateKey: entry.dateKey,
          brandId: entry.allocations[0]?.brandId ?? null,
          processId: entry.allocations[0]?.processId ?? null,
          employeeId: emp.id,
          severity: "HARD",
          conflictType: "INCOMPATIBLE_SHIFT",
          description: `${emp.name} (${emp.shiftWindow} shift) has incompatible shift allocations (${shiftList}) on ${entry.dateKey}.`,
          suggestions: [],
        });
      }

      // Capacity / double-booking check across multiple brands
      const totalCapacity = entry.allocations.reduce(
        (sum, a) => sum + a.capacityWeight,
        0
      );
      if (totalCapacity > 1.5) {
        const brandsCovered = Array.from(
          new Set(
            entry.allocations.map(
              (a) => brandMap.get(a.brandId)?.name ?? a.brandId
            )
          )
        ).join(", ");
        conflicts.push({
          dateKey: entry.dateKey,
          brandId: entry.allocations[0]?.brandId ?? null,
          processId: null,
          employeeId: emp.id,
          severity: "HARD",
          conflictType: "DOUBLE_BOOKED",
          description: `${emp.name} is over-allocated (${totalCapacity.toFixed(1)} FTE load across ${brandsCovered}) on ${entry.dateKey}.`,
          suggestions: [],
        });
      }
    }
  }

  // 5. Cascading Cross-Brand Gap detection
  const empPrimaryBrands = new Map<string, Set<string>>();
  for (const a of input.assignments) {
    if (a.allocationType !== "PRIMARY") continue;
    const set = empPrimaryBrands.get(a.employeeId) ?? new Set<string>();
    set.add(a.brandId);
    empPrimaryBrands.set(a.employeeId, set);
  }

  for (const [empId, brandIds] of empPrimaryBrands.entries()) {
    if (brandIds.size < 2) continue;
    const emp = employeeMap.get(empId);
    if (!emp || !emp.active) continue;

    for (const day of calendar) {
      const entry = entryMap.get(`${empId}::${day.dateKey}`);
      if (!entry || entry.status === "WORKING" || entry.status === "PUBLIC_HOLIDAY") {
        continue;
      }
      const gappedBrandsToday = brandGapByDate.get(day.dateKey);
      if (!gappedBrandsToday) continue;

      const affectedBrands = Array.from(brandIds).filter((bId) =>
        gappedBrandsToday.has(bId)
      );
      if (affectedBrands.length >= 2) {
        const names = affectedBrands
          .map((id) => brandMap.get(id)?.name ?? id)
          .join(", ");
        conflicts.push({
          dateKey: day.dateKey,
          brandId: affectedBrands[0],
          processId: null,
          employeeId: emp.id,
          severity: "HARD",
          conflictType: "CASCADING_GAP",
          description: `${emp.name}'s ${entry.status.replace("_", " ").toLowerCase()} on ${day.dateKey} causes cascading coverage gaps across ${affectedBrands.length} brands: ${names}.`,
          suggestions: [],
        });
      }
    }
  }

  // 6. Weekly Off Deficit & Preference Violation checks
  const weekIndices = Array.from(new Set(calendar.map((d) => d.weekIndex)));
  for (const emp of input.employees) {
    if (!emp.active) continue;

    for (const weekIdx of weekIndices) {
      const weekDays = calendar.filter((d) => d.weekIndex === weekIdx);
      let workingDays = 0;
      const weeklyOffDays: CalendarDay[] = [];

      for (const day of weekDays) {
        const entry = entryMap.get(`${emp.id}::${day.dateKey}`);
        if (!entry) continue;
        if (entry.status === "WORKING") workingDays++;
        if (entry.status === "WEEKLY_OFF") weeklyOffDays.push(day);
      }

      if (workingDays > emp.maxWeeklyWorkdays) {
        const lastDay = weekDays[weekDays.length - 1];
        conflicts.push({
          dateKey: lastDay.dateKey,
          brandId: null,
          processId: null,
          employeeId: emp.id,
          severity: "HARD",
          conflictType: "WEEKLY_OFF_DEFICIT",
          description: `${emp.name} is scheduled ${workingDays} days in week ${weekIdx + 1}, exceeding max ${emp.maxWeeklyWorkdays} working days/week.`,
          suggestions: [],
        });
      }

      if (emp.preferredOffDay !== null && weeklyOffDays.length > 0) {
        const preferredInWeek = weekDays.find(
          (d) => d.dayOfWeek === emp.preferredOffDay
        );
        const gotPreferred = weeklyOffDays.some(
          (d) => d.dayOfWeek === emp.preferredOffDay
        );
        if (preferredInWeek && !gotPreferred) {
          const prefEntry = entryMap.get(
            `${emp.id}::${preferredInWeek.dateKey}`
          );
          if (prefEntry?.status === "WORKING") {
            const actualDay = weeklyOffDays[0];
            conflicts.push({
              dateKey: actualDay.dateKey,
              brandId: null,
              processId: null,
              employeeId: emp.id,
              severity: "SOFT",
              conflictType: "PREFERENCE_VIOLATED",
              description: `${emp.name} received weekly off on ${DAY_NAMES[actualDay.dayOfWeek]} (${actualDay.dateKey}) instead of preferred ${DAY_NAMES[emp.preferredOffDay]} because client coverage took priority.`,
              suggestions: [],
            });
          }
        }
      }
    }
  }

  // 7. Fairness warnings (consecutive stretch > 7 days)
  conflicts.push(
    ...detectFairnessWarnings(calendar, input.employees, entriesList)
  );

  return conflicts;
}
