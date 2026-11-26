import { z } from "zod";

export const podSchema = z.object({
  name: z.string().trim().min(2, "Pod name must be at least 2 characters"),
  description: z.string().trim().optional().nullable(),
  leadId: z.string().optional().nullable(),
});

export const employeeSchema = z.object({
  name: z.string().trim().min(2, "Employee name is required"),
  email: z.string().trim().email("Valid email required").optional().or(z.literal("")),
  role: z.enum(["AGENT", "POD_LEAD", "BACKUP_FLOAT"]).default("AGENT"),
  podId: z.string().min(1, "Pod is required"),
  maxWeeklyWorkdays: z.coerce.number().int().min(1).max(7).default(6),
  preferredOffDay: z.coerce.number().int().min(0).max(6).nullable().optional(),
  shiftWindow: z
    .enum(["STANDARD", "MORNING", "EVENING", "NIGHT", "FLEXIBLE"])
    .default("STANDARD"),
  active: z.boolean().default(true),
});

export const brandSchema = z.object({
  name: z.string().trim().min(2, "Brand name is required"),
  code: z
    .string()
    .trim()
    .min(2)
    .max(10)
    .transform((v) => v.toUpperCase()),
  category: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  active: z.boolean().default(true),
});

export const processSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(16)
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2, "Process name is required"),
  description: z.string().trim().optional().nullable(),
});

export const brandProcessConfigSchema = z.object({
  brandId: z.string().min(1),
  processId: z.string().min(1),
  operatingRule: z.enum([
    "EVERY_DAY",
    "DAILY_NO_HOLIDAYS",
    "NO_SUNDAYS_NO_HOLIDAYS",
    "CUSTOM",
  ]),
  shiftWindow: z
    .enum(["STANDARD", "MORNING", "EVENING", "NIGHT"])
    .default("STANDARD"),
  minStaff: z.coerce.number().int().min(1).max(20).default(1),
  dayOverrides: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

export const assignmentSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  brandId: z.string().min(1, "Brand is required"),
  processId: z.string().min(1, "Process is required"),
  allocationType: z.enum(["PRIMARY", "BACKUP"]).default("PRIMARY"),
  shiftWindow: z
    .enum(["STANDARD", "MORNING", "EVENING", "NIGHT"])
    .default("STANDARD"),
  capacityWeight: z.coerce.number().min(0.1).max(2.0).default(1.0),
  priority: z.coerce.number().int().min(1).max(10).default(1),
});

export const timeOffSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  startDate: z.string().min(10, "Start date is required"),
  endDate: z.string().min(10, "End date is required"),
  type: z.enum(["PLANNED_LEAVE", "COMP_OFF", "UNAVAILABLE"]),
  status: z.enum(["APPROVED", "PENDING", "REJECTED"]).default("APPROVED"),
  reason: z.string().trim().optional().nullable(),
});

export const holidaySchema = z.object({
  date: z.string().min(10, "Date is required"),
  name: z.string().trim().min(2, "Holiday name is required"),
  scope: z.string().default("GLOBAL"),
});
