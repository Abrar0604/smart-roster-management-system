import Link from "next/link";
import { getRosterWorkspaceData } from "@/lib/queries/roster-queries";
import { toDateKey } from "@/lib/utils";
import { PodViewClient } from "@/components/views/pod-view";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PodViewPage({
  searchParams,
}: {
  searchParams: Promise<{ rosterId?: string }>;
}) {
  const sp = await searchParams;
  const data = await getRosterWorkspaceData({ rosterId: sp.rosterId });

  if (!data.roster) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center space-y-3">
        <p className="text-sm text-slate-600">No generated roster found yet.</p>
        <Button asChild size="sm">
          <Link href="/roster/generate">Generate Monthly Roster</Link>
        </Button>
      </div>
    );
  }

  const empPodMap = new Map(data.employees.map((e) => [e.id, e.podId]));
  const podConflictCounts: Record<string, number> = {};
  for (const c of data.parsedConflicts) {
    if (c.severity === "HARD" && c.employeeId) {
      const podId = empPodMap.get(c.employeeId);
      if (podId) {
        podConflictCounts[podId] = (podConflictCounts[podId] ?? 0) + 1;
      }
    }
  }

  return (
    <PodViewClient
      roster={{
        id: data.roster.id,
        month: data.roster.month,
        year: data.roster.year,
        status: data.roster.status,
      }}
      allRosters={data.allRosters.map((r) => ({
        id: r.id,
        month: r.month,
        year: r.year,
        status: r.status,
      }))}
      calendar={data.calendar.map((d) => ({
        dateKey: d.dateKey,
        dayOfMonth: d.dayOfMonth,
        dayOfWeek: d.dayOfWeek,
        globalHolidayName: d.globalHolidayName,
      }))}
      pods={data.pods.map((p) => ({
        id: p.id,
        name: p.name,
        leadName: p.lead?.name ?? null,
      }))}
      employees={data.employees
        .filter((e) => e.active)
        .map((e) => ({
          id: e.id,
          name: e.name,
          role: e.role,
          podId: e.podId,
          primaryBrands: Array.from(
            new Set(
              e.assignments
                .filter((a) => a.allocationType === "PRIMARY")
                .map((a) => a.brand.code)
            )
          ),
        }))}
      entries={data.roster.entries.map((e) => ({
        employeeId: e.employeeId,
        dateKey: toDateKey(e.date),
        status: e.status,
        allocSummary: e.allocations
          .map((a) => `${a.brand.code}:${a.process.code}`)
          .join(", "),
      }))}
      fairnessStats={data.fairnessStats}
      podConflictCounts={podConflictCounts}
    />
  );
}
