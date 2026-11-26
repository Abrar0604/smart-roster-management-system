import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateRosterEntryAndValidate } from "@/lib/scheduler/service";

const updateSchema = z.object({
  rosterId: z.string().min(1),
  entryId: z.string().min(1),
  status: z.enum([
    "WORKING",
    "WEEKLY_OFF",
    "PUBLIC_HOLIDAY",
    "PLANNED_LEAVE",
    "COMP_OFF",
    "UNAVAILABLE",
  ]),
  shiftWindow: z
    .enum(["STANDARD", "MORNING", "EVENING", "NIGHT", "FLEXIBLE"])
    .optional(),
  overrideReason: z.string().optional().nullable(),
  allocations: z
    .array(
      z.object({
        brandId: z.string().min(1),
        processId: z.string().min(1),
        shiftWindow: z
          .enum(["STANDARD", "MORNING", "EVENING", "NIGHT", "FLEXIBLE"])
          .optional(),
        isBackup: z.boolean().optional(),
        capacityWeight: z.number().optional(),
      })
    )
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = updateSchema.parse(body);
    const conflicts = await updateRosterEntryAndValidate(parsed);

    return NextResponse.json({
      ok: true,
      hardConflicts: conflicts.filter((c) => c.severity === "HARD").length,
      softConflicts: conflicts.filter((c) => c.severity === "SOFT").length,
      conflicts,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 400 }
    );
  }
}
