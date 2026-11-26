import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAY_SHORT_NAMES = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const;

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function toDateKey(date: Date | string): string {
  if (typeof date === "string") {
    return date.slice(0, 10);
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseUTCDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

export function formatMonthYear(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1] ?? `Month ${month}`} ${year}`;
}

export function getOperatingRuleLabel(rule: string): string {
  switch (rule) {
    case "EVERY_DAY":
      return "365 Days (All Days & Holidays)";
    case "DAILY_NO_HOLIDAYS":
      return "Daily Except Public Holidays";
    case "NO_SUNDAYS_NO_HOLIDAYS":
      return "Mon–Sat (Sundays & Holidays Off)";
    case "CUSTOM":
      return "Custom Day Schedule";
    default:
      return rule;
  }
}

export function getShiftWindowLabel(shift: string): string {
  switch (shift) {
    case "STANDARD":
      return "Standard Day (9:00–18:00)";
    case "MORNING":
      return "Morning (6:00–15:00)";
    case "EVENING":
      return "Evening (14:00–23:00)";
    case "NIGHT":
      return "Night (22:00–07:00)";
    case "FLEXIBLE":
      return "Flexible";
    default:
      return shift;
  }
}
