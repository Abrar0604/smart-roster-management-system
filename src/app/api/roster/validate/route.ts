import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { revalidateRosterInDb } from "@/lib/scheduler/service";

const validateSchema = z.object({
  rosterId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rosterId } = validateSchema.parse(body);
    const conflicts = await revalidateRosterInDb(rosterId);

    return NextResponse.json({
      rosterId,
      hardConflicts: conflicts.filter((c) => c.severity === "HARD").length,
      softConflicts: conflicts.filter((c) => c.severity === "SOFT").length,
      conflicts,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Validation failed" },
      { status: 400 }
    );
  }
}
