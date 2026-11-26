import type {
  CalendarDay,
  DemandSlot,
  DomainAssignment,
  DomainEmployee,
  DomainTimeOff,
  EntryStatus,
  GeneratedEntry,
  ShiftWindow,
} from "@/lib/types";

export function areShiftsCompatible(a: ShiftWindow, b: ShiftWindow): boolean {
  if (a === "FLEXIBLE" || b === "FLEXIBLE") return true;
  return a === b;
}

export function buildTimeOffLookup(
  timeOffs: DomainTimeOff[]
): Map<string, DomainTimeOff> {
  const map = new Map<string, DomainTimeOff>();
  for (const t of timeOffs) {
    if (t.status === "APPROVED") {
      map.set(`${t.employeeId}::${t.dateKey}`, t);
    }
  }
  return map;
}

/**
 * Determines whether a given employee gets automatic PUBLIC_HOLIDAY off on a date:
 * Only when it is a holiday AND none of the employee's PRIMARY assignments operate on that date.
 */
export function isEmployeeHolidayOff(
  employee: DomainEmployee,
  day: CalendarDay,
  primaryAssignments: DomainAssignment[],
  demandMap: Map<string, DemandSlot>
): boolean {
  if (!day.globalHolidayName && Object.keys(day.brandHolidayNames).length === 0) {
    return false;
  }
  if (employee.role === "BACKUP_FLOAT" && primaryAssignments.length === 0) {
    // Backup floats remain available on holidays unless they have approved TimeOff,
    // enabling coverage of 365-day single-resource brands on public holidays.
    return false;
  }
  if (primaryAssignments.length === 0) {
    return Boolean(day.globalHolidayName);
  }

  let hasAnyOperatingBrand = false;
  let hasAnyHolidayBrand = false;
  for (const a of primaryAssignments) {
    const slot = demandMap.get(`${day.dateKey}::${a.brandId}::${a.processId}`);
    if (!slot) continue;
    if (slot.isOperatingDay) {
      hasAnyOperatingBrand = true;
    }
    if (slot.isHolidayForBrand) {
      hasAnyHolidayBrand = true;
    }
  }

  return hasAnyHolidayBrand && !hasAnyOperatingBrand;
}

/**
 * Initializes daily entry skeletons and locks immovable unavailability:
 * approved planned leaves, approved comp-offs, unavailability blocks, and applicable public holidays.
 */
export function initializeLockedEntries(
  calendar: CalendarDay[],
  employees: DomainEmployee[],
  assignments: DomainAssignment[],
  demandMap: Map<string, DemandSlot>,
  timeOffs: DomainTimeOff[]
): {
  entries: Map<string, GeneratedEntry>;
  lockedKeys: Set<string>;
} {
  const timeOffLookup = buildTimeOffLookup(timeOffs);
  const entries = new Map<string, GeneratedEntry>();
  const lockedKeys = new Set<string>();

  for (const emp of employees) {
    if (!emp.active) continue;
    const empPrimaryAssignments = assignments.filter(
      (a) => a.employeeId === emp.id && a.allocationType === "PRIMARY"
    );

    for (const day of calendar) {
      const key = `${emp.id}::${day.dateKey}`;
      const timeOff = timeOffLookup.get(key);

      if (timeOff) {
        const status: EntryStatus =
          timeOff.type === "COMP_OFF"
            ? "COMP_OFF"
            : timeOff.type === "UNAVAILABLE"
              ? "UNAVAILABLE"
              : "PLANNED_LEAVE";
        entries.set(key, {
          dateKey: day.dateKey,
          employeeId: emp.id,
          status,
          shiftWindow: emp.shiftWindow,
          isManualOverride: false,
          overrideReason: timeOff.reason,
          allocations: [],
        });
        lockedKeys.add(key);
        continue;
      }

      if (isEmployeeHolidayOff(emp, day, empPrimaryAssignments, demandMap)) {
        entries.set(key, {
          dateKey: day.dateKey,
          employeeId: emp.id,
          status: "PUBLIC_HOLIDAY",
          shiftWindow: emp.shiftWindow,
          isManualOverride: false,
          overrideReason:
            day.globalHolidayName ??
            Object.values(day.brandHolidayNames)[0] ??
            "Public Holiday",
          allocations: [],
        });
        lockedKeys.add(key);
        continue;
      }

      entries.set(key, {
        dateKey: day.dateKey,
        employeeId: emp.id,
        status: "WORKING",
        shiftWindow: emp.shiftWindow,
        isManualOverride: false,
        overrideReason: null,
        allocations: [],
      });
    }
  }

  return { entries, lockedKeys };
}
