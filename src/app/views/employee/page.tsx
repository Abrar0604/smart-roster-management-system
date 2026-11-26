import Link from "next/link";
import { getRosterWorkspaceData } from "@/lib/queries/roster-queries";
import { toDateKey } from "@/lib/utils";
import { EmployeeViewClient } from "@/components/views/employee-view";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function EmployeeViewPage({
  searchParams,
}: {
  searchParams: Promise<{ rosterId?: string; employeeId?: string }>;
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

  return (
    <EmployeeViewClient
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
      employees={data.employees
        .filter((e) => e.active)
        .map((e) => ({
          id: e.id,
          name: e.name,
          email: e.email,
          role: e.role,
          podName: e.pod.name,
          shiftWindow: e.shiftWindow,
          maxWeeklyWorkdays: e.maxWeeklyWorkdays,
          preferredOffDay: e.preferredOffDay,
          assignments: e.assignments.map((a) => ({
            brandCode: a.brand.code,
            brandName: a.brand.name,
            processCode: a.process.code,
            allocationType: a.allocationType,
          })),
        }))}
      entries={data.roster.entries.map((e) => ({
        dateKey: toDateKey(e.date),
        employeeId: e.employeeId,
        status: e.status,
        overrideReason: e.overrideReason,
        allocations: e.allocations.map((a) => ({
          brandCode: a.brand.code,
          brandName: a.brand.name,
          processCode: a.process.code,
          isBackup: a.isBackup,
        })),
      }))}
      initialEmployeeId={sp.employeeId}
    />
  );
}
