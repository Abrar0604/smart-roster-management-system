import Link from "next/link";
import { getRosterWorkspaceData } from "@/lib/queries/roster-queries";
import { toDateKey } from "@/lib/utils";
import { CompanyViewClient } from "@/components/views/company-view";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CompanyViewPage({
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

  const hardConflictCellKeys = data.parsedConflicts
    .filter((c) => c.severity === "HARD" && c.employeeId)
    .map((c) => `${c.employeeId}::${c.dateKey}`);

  return (
    <CompanyViewClient
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
      pods={data.pods.map((p) => ({ id: p.id, name: p.name }))}
      employees={data.employees
        .filter((e) => e.active)
        .map((e) => ({
          id: e.id,
          name: e.name,
          role: e.role,
          podId: e.podId,
          podName: e.pod.name,
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
        hasBackup: e.allocations.some((a) => a.isBackup),
      }))}
      hardConflictCellKeys={hardConflictCellKeys}
      coverageStats={data.coverageStats}
    />
  );
}
