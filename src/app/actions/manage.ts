"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { parseUTCDate } from "@/lib/utils";
import {
  assignmentSchema,
  brandProcessConfigSchema,
  brandSchema,
  employeeSchema,
  holidaySchema,
  podSchema,
  processSchema,
  timeOffSchema,
} from "@/lib/validations";

function revalidateAll() {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/manage/pods");
  revalidatePath("/manage/employees");
  revalidatePath("/manage/brands");
  revalidatePath("/manage/processes");
  revalidatePath("/manage/assignments");
  revalidatePath("/manage/holidays");
  revalidatePath("/manage/time-offs");
  revalidatePath("/roster/generate");
  revalidatePath("/views/company");
  revalidatePath("/views/pod");
  revalidatePath("/views/brand");
  revalidatePath("/views/process");
  revalidatePath("/views/employee");
}

// ===============================================
// PODS
// ===============================================
export async function createPodAction(input: {
  name: string;
  description?: string | null;
  leadId?: string | null;
}) {
  const parsed = podSchema.parse(input);
  await prisma.pod.create({
    data: {
      name: parsed.name,
      description: parsed.description || null,
      leadId: parsed.leadId || null,
    },
  });
  revalidateAll();
}

export async function updatePodAction(
  id: string,
  input: { name: string; description?: string | null; leadId?: string | null }
) {
  const parsed = podSchema.parse(input);
  await prisma.pod.update({
    where: { id },
    data: {
      name: parsed.name,
      description: parsed.description || null,
      leadId: parsed.leadId || null,
    },
  });
  revalidateAll();
}

export async function deletePodAction(id: string) {
  const count = await prisma.employee.count({ where: { podId: id } });
  if (count > 0) {
    throw new Error(
      `Cannot delete pod while ${count} employee(s) are still assigned to it. Reassign them first.`
    );
  }
  await prisma.pod.delete({ where: { id } });
  revalidateAll();
}

// ===============================================
// EMPLOYEES
// ===============================================
export async function createEmployeeAction(input: Record<string, unknown>) {
  const parsed = employeeSchema.parse(input);
  await prisma.employee.create({
    data: {
      name: parsed.name,
      email: parsed.email || null,
      role: parsed.role,
      podId: parsed.podId,
      maxWeeklyWorkdays: parsed.maxWeeklyWorkdays,
      preferredOffDay:
        parsed.preferredOffDay === undefined ? null : parsed.preferredOffDay,
      shiftWindow: parsed.shiftWindow,
      active: parsed.active,
    },
  });
  revalidateAll();
}

export async function updateEmployeeAction(
  id: string,
  input: Record<string, unknown>
) {
  const parsed = employeeSchema.parse(input);
  await prisma.employee.update({
    where: { id },
    data: {
      name: parsed.name,
      email: parsed.email || null,
      role: parsed.role,
      podId: parsed.podId,
      maxWeeklyWorkdays: parsed.maxWeeklyWorkdays,
      preferredOffDay:
        parsed.preferredOffDay === undefined ? null : parsed.preferredOffDay,
      shiftWindow: parsed.shiftWindow,
      active: parsed.active,
    },
  });
  revalidateAll();
}

export async function deleteEmployeeAction(id: string) {
  await prisma.pod.updateMany({
    where: { leadId: id },
    data: { leadId: null },
  });
  await prisma.employee.delete({ where: { id } });
  revalidateAll();
}

// ===============================================
// BRANDS & OPERATING RULES
// ===============================================
export async function createBrandAction(input: Record<string, unknown>) {
  const parsed = brandSchema.parse(input);
  await prisma.brand.create({
    data: {
      name: parsed.name,
      code: parsed.code,
      category: parsed.category || null,
      description: parsed.description || null,
      active: parsed.active,
    },
  });
  revalidateAll();
}

export async function updateBrandAction(
  id: string,
  input: Record<string, unknown>
) {
  const parsed = brandSchema.parse(input);
  await prisma.brand.update({
    where: { id },
    data: {
      name: parsed.name,
      code: parsed.code,
      category: parsed.category || null,
      description: parsed.description || null,
      active: parsed.active,
    },
  });
  revalidateAll();
}

export async function deleteBrandAction(id: string) {
  await prisma.brand.delete({ where: { id } });
  revalidateAll();
}

export async function upsertBrandProcessConfigAction(
  input: Record<string, unknown>
) {
  const parsed = brandProcessConfigSchema.parse(input);
  await prisma.brandProcessConfig.upsert({
    where: {
      brandId_processId: {
        brandId: parsed.brandId,
        processId: parsed.processId,
      },
    },
    create: {
      brandId: parsed.brandId,
      processId: parsed.processId,
      operatingRule: parsed.operatingRule,
      shiftWindow: parsed.shiftWindow,
      minStaff: parsed.minStaff,
      dayOverrides: parsed.dayOverrides || null,
      active: parsed.active,
    },
    update: {
      operatingRule: parsed.operatingRule,
      shiftWindow: parsed.shiftWindow,
      minStaff: parsed.minStaff,
      dayOverrides: parsed.dayOverrides || null,
      active: parsed.active,
    },
  });
  revalidateAll();
}

export async function deleteBrandProcessConfigAction(id: string) {
  await prisma.brandProcessConfig.delete({ where: { id } });
  revalidateAll();
}

// ===============================================
// PROCESSES
// ===============================================
export async function createProcessAction(input: Record<string, unknown>) {
  const parsed = processSchema.parse(input);
  await prisma.process.create({
    data: {
      code: parsed.code,
      name: parsed.name,
      description: parsed.description || null,
    },
  });
  revalidateAll();
}

export async function updateProcessAction(
  id: string,
  input: Record<string, unknown>
) {
  const parsed = processSchema.parse(input);
  await prisma.process.update({
    where: { id },
    data: {
      code: parsed.code,
      name: parsed.name,
      description: parsed.description || null,
    },
  });
  revalidateAll();
}

export async function deleteProcessAction(id: string) {
  await prisma.process.delete({ where: { id } });
  revalidateAll();
}

// ===============================================
// ASSIGNMENTS
// ===============================================
export async function upsertAssignmentAction(input: Record<string, unknown>) {
  const parsed = assignmentSchema.parse(input);
  await prisma.assignment.upsert({
    where: {
      employeeId_brandId_processId: {
        employeeId: parsed.employeeId,
        brandId: parsed.brandId,
        processId: parsed.processId,
      },
    },
    create: {
      employeeId: parsed.employeeId,
      brandId: parsed.brandId,
      processId: parsed.processId,
      allocationType: parsed.allocationType,
      shiftWindow: parsed.shiftWindow,
      capacityWeight: parsed.capacityWeight,
      priority: parsed.priority,
    },
    update: {
      allocationType: parsed.allocationType,
      shiftWindow: parsed.shiftWindow,
      capacityWeight: parsed.capacityWeight,
      priority: parsed.priority,
    },
  });
  revalidateAll();
}

export async function deleteAssignmentAction(id: string) {
  await prisma.assignment.delete({ where: { id } });
  revalidateAll();
}

// ===============================================
// PUBLIC HOLIDAYS
// ===============================================
export async function createHolidayAction(input: Record<string, unknown>) {
  const parsed = holidaySchema.parse(input);
  await prisma.publicHoliday.create({
    data: {
      date: parseUTCDate(parsed.date),
      name: parsed.name,
      scope: parsed.scope,
    },
  });
  revalidateAll();
}

export async function deleteHolidayAction(id: string) {
  await prisma.publicHoliday.delete({ where: { id } });
  revalidateAll();
}

// ===============================================
// TIME OFFS (PLANNED LEAVE / COMP-OFF / UNAVAILABLE)
// ===============================================
export async function createTimeOffRangeAction(input: Record<string, unknown>) {
  const parsed = timeOffSchema.parse(input);
  const start = parseUTCDate(parsed.startDate);
  const end = parseUTCDate(parsed.endDate);
  if (end < start) {
    throw new Error("End date must be on or after start date");
  }

  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < 31) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  for (const d of dates) {
    await prisma.timeOff.upsert({
      where: {
        employeeId_date: {
          employeeId: parsed.employeeId,
          date: d,
        },
      },
      create: {
        employeeId: parsed.employeeId,
        date: d,
        type: parsed.type,
        status: parsed.status,
        reason: parsed.reason || null,
      },
      update: {
        type: parsed.type,
        status: parsed.status,
        reason: parsed.reason || null,
      },
    });
  }
  revalidateAll();
}

export async function updateTimeOffStatusAction(
  id: string,
  status: "APPROVED" | "PENDING" | "REJECTED"
) {
  await prisma.timeOff.update({
    where: { id },
    data: { status },
  });
  revalidateAll();
}

export async function deleteTimeOffAction(id: string) {
  await prisma.timeOff.delete({ where: { id } });
  revalidateAll();
}
