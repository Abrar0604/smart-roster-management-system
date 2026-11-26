import { describe, expect, it } from "vitest";
import { buildCalendar } from "../calendar";
import { computeDemand } from "../demand";
import { runScheduler } from "../engine";
import { applyEmployeeUnavailability } from "../partial-regen";
import { validateRoster } from "../validator";
import type { SchedulerInput } from "@/lib/types";

function makeBaseInput(overrides: Partial<SchedulerInput> = {}): SchedulerInput {
  return {
    month: 12,
    year: 2026,
    pods: [{ id: "pod-1", name: "Alpha", leadId: "emp-1" }],
    employees: [],
    brands: [],
    processes: [
      { id: "proc-cs", code: "CS", name: "Customer Support" },
      { id: "proc-acc", code: "ACC", name: "Abandoned Cart" },
      { id: "proc-ndr", code: "NDR", name: "NDR Management" },
    ],
    configs: [],
    assignments: [],
    timeOffs: [],
    holidays: [
      { id: "hol-1", dateKey: "2026-12-25", name: "Christmas", scope: "GLOBAL" },
    ],
    ...overrides,
  };
}

describe("Smart Roster Scheduling & Validation Engine", () => {
  it("1. Single-resource brand with NO_SUNDAYS_NO_HOLIDAYS gets Sunday off with zero conflicts", () => {
    const input = makeBaseInput({
      employees: [
        {
          id: "emp-1",
          name: "Aarav",
          email: "aarav@example.com",
          role: "AGENT",
          podId: "pod-1",
          maxWeeklyWorkdays: 6,
          preferredOffDay: 0, // Sunday
          shiftWindow: "STANDARD",
          active: true,
        },
      ],
      brands: [{ id: "brand-1", name: "Velvet", code: "VELV", active: true }],
      configs: [
        {
          id: "cfg-1",
          brandId: "brand-1",
          processId: "proc-cs",
          operatingRule: "NO_SUNDAYS_NO_HOLIDAYS",
          shiftWindow: "STANDARD",
          minStaff: 1,
          dayOverrides: null,
          active: true,
        },
      ],
      assignments: [
        {
          id: "asg-1",
          employeeId: "emp-1",
          brandId: "brand-1",
          processId: "proc-cs",
          allocationType: "PRIMARY",
          shiftWindow: "STANDARD",
          capacityWeight: 1,
          priority: 1,
        },
      ],
    });

    const result = runScheduler(input);
    expect(result.stats.hardConflicts).toBe(0);
    expect(result.stats.coveragePercent).toBe(100);

    const dec25 = result.entries.find((e) => e.dateKey === "2026-12-25");
    expect(dec25?.status).toBe("PUBLIC_HOLIDAY");

    const dec6Sun = result.entries.find((e) => e.dateKey === "2026-12-06");
    expect(dec6Sun?.status).toBe("WEEKLY_OFF");
  });

  it("2. Single-resource brand with EVERY_DAY flags HARD UNCOVERED conflict when no backup exists", () => {
    const input = makeBaseInput({
      holidays: [],
      employees: [
        {
          id: "emp-1",
          name: "Diya",
          email: null,
          role: "AGENT",
          podId: "pod-1",
          maxWeeklyWorkdays: 6,
          preferredOffDay: 0,
          shiftWindow: "STANDARD",
          active: true,
        },
      ],
      brands: [{ id: "brand-1", name: "Saffron", code: "SAFF", active: true }],
      configs: [
        {
          id: "cfg-1",
          brandId: "brand-1",
          processId: "proc-cs",
          operatingRule: "EVERY_DAY",
          shiftWindow: "STANDARD",
          minStaff: 1,
          dayOverrides: null,
          active: true,
        },
      ],
      assignments: [
        {
          id: "asg-1",
          employeeId: "emp-1",
          brandId: "brand-1",
          processId: "proc-cs",
          allocationType: "PRIMARY",
          shiftWindow: "STANDARD",
          capacityWeight: 1,
          priority: 1,
        },
      ],
    });

    const result = runScheduler(input);
    const uncovered = result.conflicts.filter(
      (c) => c.severity === "HARD" && c.conflictType === "UNCOVERED"
    );
    expect(uncovered.length).toBeGreaterThanOrEqual(4);
    expect(result.stats.coveragePercent).toBeLessThan(100);
  });

  it("3. Single-resource brand with EVERY_DAY activates backup float on weekly off day cleanly", () => {
    const input = makeBaseInput({
      holidays: [],
      employees: [
        {
          id: "emp-1",
          name: "Kiran",
          email: null,
          role: "AGENT",
          podId: "pod-1",
          maxWeeklyWorkdays: 6,
          preferredOffDay: 0,
          shiftWindow: "STANDARD",
          active: true,
        },
        {
          id: "emp-float",
          name: "Float Sam",
          email: null,
          role: "BACKUP_FLOAT",
          podId: "pod-1",
          maxWeeklyWorkdays: 6,
          preferredOffDay: 2,
          shiftWindow: "STANDARD",
          active: true,
        },
      ],
      brands: [{ id: "brand-1", name: "Kaya", code: "KAYA", active: true }],
      configs: [
        {
          id: "cfg-1",
          brandId: "brand-1",
          processId: "proc-cs",
          operatingRule: "EVERY_DAY",
          shiftWindow: "STANDARD",
          minStaff: 1,
          dayOverrides: null,
          active: true,
        },
      ],
      assignments: [
        {
          id: "asg-1",
          employeeId: "emp-1",
          brandId: "brand-1",
          processId: "proc-cs",
          allocationType: "PRIMARY",
          shiftWindow: "STANDARD",
          capacityWeight: 1,
          priority: 1,
        },
        {
          id: "asg-2",
          employeeId: "emp-float",
          brandId: "brand-1",
          processId: "proc-cs",
          allocationType: "BACKUP",
          shiftWindow: "STANDARD",
          capacityWeight: 0.5,
          priority: 2,
        },
      ],
    });

    const result = runScheduler(input);
    expect(result.stats.hardConflicts).toBe(0);
    expect(result.stats.coveragePercent).toBe(100);
    expect(result.stats.backupActivations).toBeGreaterThanOrEqual(4);
  });

  it("4. Mandatory client coverage overrides preferred weekly-off day and raises SOFT preference warning", () => {
    const input = makeBaseInput({
      holidays: [],
      employees: [
        {
          id: "emp-1",
          name: "Neha",
          email: null,
          role: "AGENT",
          podId: "pod-1",
          maxWeeklyWorkdays: 6,
          preferredOffDay: 1, // Prefers Monday, but brand operates Mon-Sat!
          shiftWindow: "STANDARD",
          active: true,
        },
      ],
      brands: [{ id: "brand-1", name: "Loom", code: "LOOM", active: true }],
      configs: [
        {
          id: "cfg-1",
          brandId: "brand-1",
          processId: "proc-cs",
          operatingRule: "NO_SUNDAYS_NO_HOLIDAYS",
          shiftWindow: "STANDARD",
          minStaff: 1,
          dayOverrides: null,
          active: true,
        },
      ],
      assignments: [
        {
          id: "asg-1",
          employeeId: "emp-1",
          brandId: "brand-1",
          processId: "proc-cs",
          allocationType: "PRIMARY",
          shiftWindow: "STANDARD",
          capacityWeight: 1,
          priority: 1,
        },
      ],
    });

    const result = runScheduler(input);
    expect(result.stats.hardConflicts).toBe(0);
    expect(result.stats.coveragePercent).toBe(100);
    const prefViolations = result.conflicts.filter(
      (c) => c.severity === "SOFT" && c.conflictType === "PREFERENCE_VIOLATED"
    );
    // Weeks 1, 2, 3 contain Mondays (Dec 1, 2026 is a Tuesday so Week 0 has no Monday)
    expect(prefViolations.length).toBe(3);
    // All Sundays should be off instead of Mondays
    const sundayEntry = result.entries.find((e) => e.dateKey === "2026-12-06");
    expect(sundayEntry?.status).toBe("WEEKLY_OFF");
  });

  it("5. Multi-resource brand with split & shared processes handles 1 employee unavailability accurately", () => {
    const input = makeBaseInput({
      holidays: [],
      employees: [
        {
          id: "emp-1",
          name: "Rohan",
          email: null,
          role: "AGENT",
          podId: "pod-1",
          maxWeeklyWorkdays: 6,
          preferredOffDay: 0,
          shiftWindow: "STANDARD",
          active: true,
        },
        {
          id: "emp-2",
          name: "Tara",
          email: null,
          role: "AGENT",
          podId: "pod-1",
          maxWeeklyWorkdays: 6,
          preferredOffDay: 2,
          shiftWindow: "STANDARD",
          active: true,
        },
        {
          id: "emp-3",
          name: "Vikram",
          email: null,
          role: "AGENT",
          podId: "pod-1",
          maxWeeklyWorkdays: 6,
          preferredOffDay: 0,
          shiftWindow: "STANDARD",
          active: true,
        },
      ],
      brands: [{ id: "brand-1", name: "Pulse", code: "PULS", active: true }],
      configs: [
        {
          id: "cfg-cs",
          brandId: "brand-1",
          processId: "proc-cs",
          operatingRule: "EVERY_DAY",
          shiftWindow: "STANDARD",
          minStaff: 1,
          dayOverrides: null,
          active: true,
        },
        {
          id: "cfg-ndr",
          brandId: "brand-1",
          processId: "proc-ndr",
          operatingRule: "NO_SUNDAYS_NO_HOLIDAYS",
          shiftWindow: "STANDARD",
          minStaff: 1,
          dayOverrides: null,
          active: true,
        },
      ],
      assignments: [
        {
          id: "a1",
          employeeId: "emp-1",
          brandId: "brand-1",
          processId: "proc-cs",
          allocationType: "PRIMARY",
          shiftWindow: "STANDARD",
          capacityWeight: 1,
          priority: 1,
        },
        {
          id: "a2",
          employeeId: "emp-2",
          brandId: "brand-1",
          processId: "proc-cs",
          allocationType: "PRIMARY",
          shiftWindow: "STANDARD",
          capacityWeight: 1,
          priority: 2,
        },
        {
          id: "a3",
          employeeId: "emp-3",
          brandId: "brand-1",
          processId: "proc-ndr",
          allocationType: "PRIMARY",
          shiftWindow: "STANDARD",
          capacityWeight: 1,
          priority: 1,
        },
      ],
    });

    const initial = runScheduler(input);
    expect(initial.stats.hardConflicts).toBe(0);

    // Scenario A: Rohan (1 of 2 on CS) unavailable on Wed Dec 16 (while Tara works) -> 0 CS gap!
    const partialA = applyEmployeeUnavailability({
      input,
      existingEntries: initial.entries,
      employeeId: "emp-1",
      targetDateKeys: ["2026-12-16"],
      newStatus: "PLANNED_LEAVE",
      reason: "Medical leave",
      autoAssignBackup: false,
    });
    expect(
      partialA.conflictsAfter.filter((c) => c.severity === "HARD").length
    ).toBe(0);

    // Scenario B: Rohan unavailable on Tue Dec 15 (same day Tara has weekly off) -> CS gap detected!
    const partialOverlap = applyEmployeeUnavailability({
      input,
      existingEntries: initial.entries,
      employeeId: "emp-1",
      targetDateKeys: ["2026-12-15"],
      newStatus: "PLANNED_LEAVE",
      reason: "Overlaps peer off day",
      autoAssignBackup: false,
    });
    expect(
      partialOverlap.conflictsAfter.some(
        (c) => c.dateKey === "2026-12-15" && c.conflictType === "UNCOVERED"
      )
    ).toBe(true);

    // Scenario C: Vikram (sole NDR owner) unavailable on Dec 16 -> NDR flagged UNCOVERED
    const partialB = applyEmployeeUnavailability({
      input,
      existingEntries: initial.entries,
      employeeId: "emp-3",
      targetDateKeys: ["2026-12-16"],
      newStatus: "UNAVAILABLE",
      reason: "Emergency",
      autoAssignBackup: false,
    });
    const ndrGap = partialB.conflictsAfter.find(
      (c) =>
        c.dateKey === "2026-12-16" &&
        c.processId === "proc-ndr" &&
        c.conflictType === "UNCOVERED"
    );
    expect(ndrGap).toBeDefined();
    expect(partialB.preservedEntriesCount).toBeGreaterThan(85);
  });

  it("9. Day-specific minStaff overrides trigger UNDERSTAFFED when only 1 staff is working on peak day", () => {
    const input = makeBaseInput({
      holidays: [],
      employees: [
        {
          id: "e1",
          name: "Agent One",
          email: null,
          role: "AGENT",
          podId: "pod-1",
          maxWeeklyWorkdays: 6,
          preferredOffDay: 0,
          shiftWindow: "STANDARD",
          active: true,
        },
      ],
      brands: [{ id: "b1", name: "Vanguard", code: "VANG", active: true }],
      configs: [
        {
          id: "c1",
          brandId: "b1",
          processId: "proc-cs",
          operatingRule: "NO_SUNDAYS_NO_HOLIDAYS",
          shiftWindow: "STANDARD",
          minStaff: 1,
          dayOverrides: { dayMinStaff: { "6": 2 } }, // Saturdays require 2 staff
          active: true,
        },
      ],
      assignments: [
        {
          id: "a1",
          employeeId: "e1",
          brandId: "b1",
          processId: "proc-cs",
          allocationType: "PRIMARY",
          shiftWindow: "STANDARD",
          capacityWeight: 1,
          priority: 1,
        },
      ],
    });

    const result = runScheduler(input);
    const satUnderstaffed = result.conflicts.filter(
      (c) => c.conflictType === "UNDERSTAFFED"
    );
    // Dec 2026 has 4 Saturdays (5, 12, 19, 26)
    expect(satUnderstaffed.length).toBe(4);
  });

  it("10. Validator flags WEEKLY_OFF_DEFICIT when an employee is manually forced to work 7 days in a week", () => {
    const input = makeBaseInput({
      holidays: [],
      employees: [
        {
          id: "e1",
          name: "Overworked Agent",
          email: null,
          role: "AGENT",
          podId: "pod-1",
          maxWeeklyWorkdays: 6,
          preferredOffDay: 0,
          shiftWindow: "STANDARD",
          active: true,
        },
      ],
      brands: [{ id: "b1", name: "BrandA", code: "BRA", active: true }],
      configs: [
        {
          id: "c1",
          brandId: "b1",
          processId: "proc-cs",
          operatingRule: "EVERY_DAY",
          shiftWindow: "STANDARD",
          minStaff: 1,
          dayOverrides: null,
          active: true,
        },
      ],
      assignments: [
        {
          id: "a1",
          employeeId: "e1",
          brandId: "b1",
          processId: "proc-cs",
          allocationType: "PRIMARY",
          shiftWindow: "STANDARD",
          capacityWeight: 1,
          priority: 1,
        },
      ],
    });

    const calendar = buildCalendar(12, 2026, []);
    const demand = computeDemand(calendar, input.configs);
    const entries = calendar.map((day) => ({
      dateKey: day.dateKey,
      employeeId: "e1",
      status: "WORKING" as const,
      shiftWindow: "STANDARD" as const,
      isManualOverride: true,
      overrideReason: "Forced all days",
      allocations: [
        {
          brandId: "b1",
          processId: "proc-cs",
          shiftWindow: "STANDARD" as const,
          isBackup: false,
          capacityWeight: 1,
        },
      ],
    }));

    const conflicts = validateRoster(input, calendar, demand, entries);
    expect(conflicts.some((c) => c.conflictType === "WEEKLY_OFF_DEFICIT")).toBe(
      true
    );
    expect(conflicts.some((c) => c.conflictType === "FAIRNESS_WARNING")).toBe(
      true
    );
  });

  it("6. Cross-brand employee absence triggers CASCADING_GAP across multiple brands", () => {
    const input = makeBaseInput({
      holidays: [],
      employees: [
        {
          id: "emp-1",
          name: "Meera",
          email: null,
          role: "AGENT",
          podId: "pod-1",
          maxWeeklyWorkdays: 6,
          preferredOffDay: 0,
          shiftWindow: "STANDARD",
          active: true,
        },
      ],
      brands: [
        { id: "b1", name: "Driftwood", code: "DRFT", active: true },
        { id: "b2", name: "Cinder", code: "CIND", active: true },
      ],
      configs: [
        {
          id: "c1",
          brandId: "b1",
          processId: "proc-cs",
          operatingRule: "NO_SUNDAYS_NO_HOLIDAYS",
          shiftWindow: "STANDARD",
          minStaff: 1,
          dayOverrides: null,
          active: true,
        },
        {
          id: "c2",
          brandId: "b2",
          processId: "proc-acc",
          operatingRule: "NO_SUNDAYS_NO_HOLIDAYS",
          shiftWindow: "STANDARD",
          minStaff: 1,
          dayOverrides: null,
          active: true,
        },
      ],
      assignments: [
        {
          id: "a1",
          employeeId: "emp-1",
          brandId: "b1",
          processId: "proc-cs",
          allocationType: "PRIMARY",
          shiftWindow: "STANDARD",
          capacityWeight: 0.5,
          priority: 1,
        },
        {
          id: "a2",
          employeeId: "emp-1",
          brandId: "b2",
          processId: "proc-acc",
          allocationType: "PRIMARY",
          shiftWindow: "STANDARD",
          capacityWeight: 0.5,
          priority: 1,
        },
      ],
      timeOffs: [
        {
          id: "to-1",
          employeeId: "emp-1",
          dateKey: "2026-12-10",
          type: "PLANNED_LEAVE",
          status: "APPROVED",
          reason: "Family event",
        },
      ],
    });

    const result = runScheduler(input);
    const cascading = result.conflicts.find(
      (c) => c.dateKey === "2026-12-10" && c.conflictType === "CASCADING_GAP"
    );
    expect(cascading).toBeDefined();
    expect(cascading?.description).toContain("Driftwood");
    expect(cascading?.description).toContain("Cinder");
  });

  it("7. Validator catches manual override LEAVE_CLASH and INCOMPATIBLE_SHIFT", () => {
    const input = makeBaseInput({
      holidays: [],
      employees: [
        {
          id: "emp-1",
          name: "Arjun",
          email: null,
          role: "AGENT",
          podId: "pod-1",
          maxWeeklyWorkdays: 6,
          preferredOffDay: 0,
          shiftWindow: "MORNING",
          active: true,
        },
      ],
      brands: [{ id: "b1", name: "BrandX", code: "BRX", active: true }],
      configs: [
        {
          id: "c1",
          brandId: "b1",
          processId: "proc-cs",
          operatingRule: "NO_SUNDAYS_NO_HOLIDAYS",
          shiftWindow: "NIGHT",
          minStaff: 1,
          dayOverrides: null,
          active: true,
        },
      ],
      assignments: [
        {
          id: "a1",
          employeeId: "emp-1",
          brandId: "b1",
          processId: "proc-cs",
          allocationType: "PRIMARY",
          shiftWindow: "NIGHT",
          capacityWeight: 1,
          priority: 1,
        },
      ],
      timeOffs: [
        {
          id: "to-1",
          employeeId: "emp-1",
          dateKey: "2026-12-08",
          type: "PLANNED_LEAVE",
          status: "APPROVED",
          reason: "Approved leave",
        },
      ],
    });

    const calendar = buildCalendar(12, 2026, []);
    const demand = computeDemand(calendar, input.configs);
    const entries = calendar.map((day) => ({
      dateKey: day.dateKey,
      employeeId: "emp-1",
      status: day.dayOfWeek === 0 ? ("WEEKLY_OFF" as const) : ("WORKING" as const),
      shiftWindow: "MORNING" as const,
      isManualOverride: day.dateKey === "2026-12-08",
      overrideReason: null,
      allocations:
        day.dayOfWeek === 0
          ? []
          : [
              {
                brandId: "b1",
                processId: "proc-cs",
                shiftWindow: "NIGHT" as const,
                isBackup: false,
                capacityWeight: 1,
              },
            ],
    }));

    const conflicts = validateRoster(input, calendar, demand, entries);
    expect(conflicts.some((c) => c.conflictType === "LEAVE_CLASH")).toBe(true);
    expect(conflicts.some((c) => c.conflictType === "INCOMPATIBLE_SHIFT")).toBe(
      true
    );
  });

  it("8. DAILY_NO_HOLIDAYS excludes holidays while EVERY_DAY still operates on holidays", () => {
    const input = makeBaseInput({
      employees: [
        {
          id: "e1",
          name: "Emp Holiday Off",
          email: null,
          role: "AGENT",
          podId: "pod-1",
          maxWeeklyWorkdays: 6,
          preferredOffDay: 0,
          shiftWindow: "STANDARD",
          active: true,
        },
        {
          id: "e2",
          name: "Emp 365",
          email: null,
          role: "AGENT",
          podId: "pod-1",
          maxWeeklyWorkdays: 6,
          preferredOffDay: 1,
          shiftWindow: "STANDARD",
          active: true,
        },
      ],
      brands: [
        { id: "b-hol", name: "HolidayClosed", code: "HCLS", active: true },
        { id: "b-365", name: "AlwaysOpen", code: "OPEN", active: true },
      ],
      configs: [
        {
          id: "c1",
          brandId: "b-hol",
          processId: "proc-cs",
          operatingRule: "DAILY_NO_HOLIDAYS",
          shiftWindow: "STANDARD",
          minStaff: 1,
          dayOverrides: null,
          active: true,
        },
        {
          id: "c2",
          brandId: "b-365",
          processId: "proc-cs",
          operatingRule: "EVERY_DAY",
          shiftWindow: "STANDARD",
          minStaff: 1,
          dayOverrides: null,
          active: true,
        },
      ],
      assignments: [
        {
          id: "a1",
          employeeId: "e1",
          brandId: "b-hol",
          processId: "proc-cs",
          allocationType: "PRIMARY",
          shiftWindow: "STANDARD",
          capacityWeight: 1,
          priority: 1,
        },
        {
          id: "a2",
          employeeId: "e2",
          brandId: "b-365",
          processId: "proc-cs",
          allocationType: "PRIMARY",
          shiftWindow: "STANDARD",
          capacityWeight: 1,
          priority: 1,
        },
      ],
    });

    const result = runScheduler(input);
    const e1Christmas = result.entries.find(
      (e) => e.employeeId === "e1" && e.dateKey === "2026-12-25"
    );
    const e2Christmas = result.entries.find(
      (e) => e.employeeId === "e2" && e.dateKey === "2026-12-25"
    );

    expect(e1Christmas?.status).toBe("PUBLIC_HOLIDAY");
    expect(e2Christmas?.status).toBe("WORKING");
  });
});
