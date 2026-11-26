import type {
  CalendarDay,
  DayOverrides,
  DemandSlot,
  DomainBrandProcessConfig,
} from "@/lib/types";

export function parseDayOverrides(raw: string | null | undefined): DayOverrides | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DayOverrides;
  } catch {
    return null;
  }
}

export function isConfigOperatingOnDay(
  config: DomainBrandProcessConfig,
  day: CalendarDay
): { isOperatingDay: boolean; isHolidayForBrand: boolean } {
  const isHolidayForBrand = Boolean(
    day.globalHolidayName || day.brandHolidayNames[config.brandId]
  );

  if (!config.active) {
    return { isOperatingDay: false, isHolidayForBrand };
  }

  switch (config.operatingRule) {
    case "EVERY_DAY":
      return { isOperatingDay: true, isHolidayForBrand };
    case "DAILY_NO_HOLIDAYS":
      return { isOperatingDay: !isHolidayForBrand, isHolidayForBrand };
    case "NO_SUNDAYS_NO_HOLIDAYS":
      return {
        isOperatingDay: day.dayOfWeek !== 0 && !isHolidayForBrand,
        isHolidayForBrand,
      };
    case "CUSTOM": {
      const overrides = config.dayOverrides;
      const operatingDays = overrides?.operatingDays ?? [1, 2, 3, 4, 5, 6];
      const excludeHolidays = overrides?.excludeHolidays ?? true;
      const dayAllowed = operatingDays.includes(day.dayOfWeek);
      const holidayOk = excludeHolidays ? !isHolidayForBrand : true;
      return { isOperatingDay: dayAllowed && holidayOk, isHolidayForBrand };
    }
    default:
      return { isOperatingDay: false, isHolidayForBrand };
  }
}

/**
 * Computes daily headcount demand for every active (brand, process) across the calendar.
 * Strictly separates client operating calendars from employee working schedules.
 */
export function computeDemand(
  calendar: CalendarDay[],
  configs: DomainBrandProcessConfig[]
): DemandSlot[] {
  const slots: DemandSlot[] = [];

  for (const config of configs) {
    if (!config.active) continue;

    for (const day of calendar) {
      const { isOperatingDay, isHolidayForBrand } = isConfigOperatingOnDay(
        config,
        day
      );

      let requiredStaff = 0;
      if (isOperatingDay) {
        const dayOverride =
          config.dayOverrides?.dayMinStaff?.[String(day.dayOfWeek)];
        requiredStaff =
          typeof dayOverride === "number" ? dayOverride : config.minStaff;
      }

      slots.push({
        dateKey: day.dateKey,
        brandId: config.brandId,
        processId: config.processId,
        isOperatingDay,
        isHolidayForBrand,
        requiredStaff,
        shiftWindow: config.shiftWindow,
      });
    }
  }

  return slots;
}
