// Core domain types shared between the pure scheduling engine, persistence layer, and UI

export type EmployeeRole = "AGENT" | "POD_LEAD" | "BACKUP_FLOAT";
export type OperatingRule =
  | "EVERY_DAY"
  | "DAILY_NO_HOLIDAYS"
  | "NO_SUNDAYS_NO_HOLIDAYS"
  | "CUSTOM";
export type ShiftWindow = "STANDARD" | "MORNING" | "EVENING" | "NIGHT" | "FLEXIBLE";
export type AllocationType = "PRIMARY" | "BACKUP";
export type TimeOffType = "PLANNED_LEAVE" | "COMP_OFF" | "UNAVAILABLE";
export type TimeOffStatus = "APPROVED" | "PENDING" | "REJECTED";
export type RosterStatus = "DRAFT" | "PUBLISHED";
export type EntryStatus =
  | "WORKING"
  | "WEEKLY_OFF"
  | "PUBLIC_HOLIDAY"
  | "PLANNED_LEAVE"
  | "COMP_OFF"
  | "UNAVAILABLE";
export type ConflictSeverity = "HARD" | "SOFT";
export type ConflictType =
  | "UNCOVERED"
  | "UNDERSTAFFED"
  | "DOUBLE_BOOKED"
  | "INCOMPATIBLE_SHIFT"
  | "LEAVE_CLASH"
  | "CASCADING_GAP"
  | "PREFERENCE_VIOLATED"
  | "WEEKLY_OFF_DEFICIT"
  | "FAIRNESS_WARNING";

export interface DayOverrides {
  operatingDays?: number[]; // 0..6
  dayMinStaff?: Record<string, number>; // "0".."6" -> min staff
  excludeHolidays?: boolean;
}

export interface DomainPod {
  id: string;
  name: string;
  leadId: string | null;
}

export interface DomainEmployee {
  id: string;
  name: string;
  email: string | null;
  role: EmployeeRole;
  podId: string;
  maxWeeklyWorkdays: number;
  preferredOffDay: number | null; // 0..6
  shiftWindow: ShiftWindow;
  active: boolean;
}

export interface DomainBrand {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export interface DomainProcess {
  id: string;
  code: string;
  name: string;
}

export interface DomainBrandProcessConfig {
  id: string;
  brandId: string;
  processId: string;
  operatingRule: OperatingRule;
  shiftWindow: ShiftWindow;
  minStaff: number;
  dayOverrides: DayOverrides | null;
  active: boolean;
}

export interface DomainAssignment {
  id: string;
  employeeId: string;
  brandId: string;
  processId: string;
  allocationType: AllocationType;
  shiftWindow: ShiftWindow;
  capacityWeight: number;
  priority: number;
}

export interface DomainTimeOff {
  id: string;
  employeeId: string;
  dateKey: string; // YYYY-MM-DD
  type: TimeOffType;
  status: TimeOffStatus;
  reason: string | null;
}

export interface DomainPublicHoliday {
  id: string;
  dateKey: string; // YYYY-MM-DD
  name: string;
  scope: string; // "GLOBAL" or brandId
}

export interface CalendarDay {
  dateKey: string; // YYYY-MM-DD
  date: Date;
  dayOfMonth: number;
  dayOfWeek: number; // 0=Sun..6=Sat
  weekIndex: number; // 0-based week bucket within month
  globalHolidayName: string | null;
  brandHolidayNames: Record<string, string>; // brandId -> holiday name
}

export interface DemandSlot {
  dateKey: string;
  brandId: string;
  processId: string;
  isOperatingDay: boolean;
  isHolidayForBrand: boolean;
  requiredStaff: number;
  shiftWindow: ShiftWindow;
}

export interface GeneratedAllocation {
  brandId: string;
  processId: string;
  shiftWindow: ShiftWindow;
  isBackup: boolean;
  capacityWeight: number;
}

export interface GeneratedEntry {
  dateKey: string;
  employeeId: string;
  status: EntryStatus;
  shiftWindow: ShiftWindow;
  isManualOverride: boolean;
  overrideReason: string | null;
  allocations: GeneratedAllocation[];
}

export interface ConflictSuggestion {
  type: "ASSIGN_BACKUP" | "REALLOCATE_PEER" | "RESCHEDULE_OFF" | "ACCEPT_OVERRIDE";
  employeeId?: string;
  employeeName?: string;
  brandId?: string;
  processId?: string;
  score?: number;
  label: string;
  reason: string;
}

export interface GeneratedConflict {
  dateKey: string;
  brandId: string | null;
  processId: string | null;
  employeeId: string | null;
  severity: ConflictSeverity;
  conflictType: ConflictType;
  description: string;
  suggestions: ConflictSuggestion[];
}

export interface SchedulerInput {
  month: number;
  year: number;
  pods: DomainPod[];
  employees: DomainEmployee[];
  brands: DomainBrand[];
  processes: DomainProcess[];
  configs: DomainBrandProcessConfig[];
  assignments: DomainAssignment[];
  timeOffs: DomainTimeOff[];
  holidays: DomainPublicHoliday[];
}

export interface SchedulerResult {
  calendar: CalendarDay[];
  demand: DemandSlot[];
  entries: GeneratedEntry[];
  conflicts: GeneratedConflict[];
  stats: {
    totalDemandSlots: number;
    coveredDemandSlots: number;
    coveragePercent: number;
    hardConflicts: number;
    softConflicts: number;
    backupActivations: number;
  };
}

export interface BackupCandidate {
  employeeId: string;
  employeeName: string;
  podId: string;
  podName?: string;
  role: EmployeeRole;
  score: number;
  matchReasons: string[];
  currentWeekWorkdays: number;
  isExplicitBackup: boolean;
  samePod: boolean;
  processTrained: boolean;
  isAvailableOnDate: boolean;
}
