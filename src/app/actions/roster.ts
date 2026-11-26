"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  applyUnavailabilityChangeInDb,
  assignBackupSuggestionInDb,
  generateAndSaveRoster,
  revalidateRosterInDb,
  updateRosterEntryAndValidate,
} from "@/lib/scheduler/service";
import type { EntryStatus, ShiftWindow } from "@/lib/types";

function revalidateRosterRoutes(rosterId?: string) {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/roster/generate");
  if (rosterId) {
    revalidatePath(`/roster/${rosterId}`);
  }
  revalidatePath("/views/company");
  revalidatePath("/views/pod");
  revalidatePath("/views/brand");
  revalidatePath("/views/process");
  revalidatePath("/views/employee");
}

export async function generateRosterAction(month: number, year: number) {
  const result = await generateAndSaveRoster(month, year);
  revalidateRosterRoutes(result.rosterId);
  return {
    rosterId: result.rosterId,
    stats: result.stats,
  };
}

export async function togglePublishRosterAction(
  rosterId: string,
  targetStatus: "DRAFT" | "PUBLISHED"
) {
  await prisma.roster.update({
    where: { id: rosterId },
    data: { status: targetStatus },
  });

  await prisma.rosterChangeLog.create({
    data: {
      rosterId,
      actionType: "PUBLISHED",
      summary:
        targetStatus === "PUBLISHED"
          ? "Published monthly roster for team visibility."
          : "Reverted roster to DRAFT for further edits.",
    },
  });

  revalidateRosterRoutes(rosterId);
}

export async function updateRosterEntryAction(params: {
  rosterId: string;
  entryId: string;
  status: EntryStatus;
  shiftWindow?: ShiftWindow;
  overrideReason?: string | null;
  allocations?: Array<{
    brandId: string;
    processId: string;
    shiftWindow?: ShiftWindow;
    isBackup?: boolean;
    capacityWeight?: number;
  }>;
}) {
  const conflicts = await updateRosterEntryAndValidate(params);
  revalidateRosterRoutes(params.rosterId);
  return {
    hardConflicts: conflicts.filter((c) => c.severity === "HARD").length,
    softConflicts: conflicts.filter((c) => c.severity === "SOFT").length,
  };
}

export async function simulateUnavailabilityAction(params: {
  rosterId: string;
  employeeId: string;
  dateKeys: string[];
  newStatus: Exclude<EntryStatus, "WORKING">;
  reason: string;
  autoAssignBackup: boolean;
}) {
  const result = await applyUnavailabilityChangeInDb(params);
  revalidateRosterRoutes(params.rosterId);
  return {
    preservedEntriesCount: result.preservedEntriesCount,
    modifiedEntriesCount: result.modifiedEntriesCount,
    hardConflictsBefore: result.conflictsBefore.filter(
      (c) => c.severity === "HARD"
    ).length,
    hardConflictsAfter: result.conflictsAfter.filter(
      (c) => c.severity === "HARD"
    ).length,
    affectedSlots: result.affectedSlots,
  };
}

export async function acceptBackupSuggestionAction(params: {
  rosterId: string;
  dateKey: string;
  employeeId: string;
  brandId: string;
  processId: string;
}) {
  const conflicts = await assignBackupSuggestionInDb(params);
  revalidateRosterRoutes(params.rosterId);
  return {
    hardConflicts: conflicts.filter((c) => c.severity === "HARD").length,
    softConflicts: conflicts.filter((c) => c.severity === "SOFT").length,
  };
}

export async function revalidateRosterAction(rosterId: string) {
  const conflicts = await revalidateRosterInDb(rosterId);
  revalidateRosterRoutes(rosterId);
  return {
    hardConflicts: conflicts.filter((c) => c.severity === "HARD").length,
    softConflicts: conflicts.filter((c) => c.severity === "SOFT").length,
  };
}
