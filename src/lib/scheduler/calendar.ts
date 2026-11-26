import type { CalendarDay, DomainPublicHoliday } from "@/lib/types";
import { toDateKey } from "@/lib/utils";

/**
 * Builds the day-by-day calendar grid for a target month and year,
 * annotating weekday indices, Monday-aligned week buckets, and holidays.
 */
export function buildCalendar(
  month: number,
  year: number,
  holidays: DomainPublicHoliday[]
): CalendarDay[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const firstDayDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  // Shift Sunday (0) to index 6 so weeks run Monday (0) .. Sunday (6)
  const firstDayMonAligned = (firstDayDow + 6) % 7;

  const globalHolidayMap = new Map<string, string>();
  const brandHolidayMap = new Map<string, Record<string, string>>();

  for (const h of holidays) {
    if (h.scope === "GLOBAL") {
      globalHolidayMap.set(h.dateKey, h.name);
    } else {
      const existing = brandHolidayMap.get(h.dateKey) ?? {};
      existing[h.scope] = h.name;
      brandHolidayMap.set(h.dateKey, existing);
    }
  }

  const days: CalendarDay[] = [];
  for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
    const date = new Date(Date.UTC(year, month - 1, dayNum, 0, 0, 0, 0));
    const dateKey = toDateKey(date);
    const dayOfWeek = date.getUTCDay();
    const weekIndex = Math.floor((dayNum - 1 + firstDayMonAligned) / 7);

    days.push({
      dateKey,
      date,
      dayOfMonth: dayNum,
      dayOfWeek,
      weekIndex,
      globalHolidayName: globalHolidayMap.get(dateKey) ?? null,
      brandHolidayNames: brandHolidayMap.get(dateKey) ?? {},
    });
  }

  return days;
}
