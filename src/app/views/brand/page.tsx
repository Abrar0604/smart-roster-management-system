import Link from "next/link";
import { getRosterWorkspaceData } from "@/lib/queries/roster-queries";
import { toDateKey } from "@/lib/utils";
import {
  BrandViewClient,
  type BrandCoverageCell,
} from "@/components/views/brand-view";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function BrandViewPage({
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

  // Index workers per (dateKey, brandId, processId)
  const workerMap = new Map<
    string,
    Array<{ name: string; isBackup: boolean }>
  >();
  for (const e of data.roster.entries) {
    if (e.status !== "WORKING") continue;
    const dk = toDateKey(e.date);
    for (const a of e.allocations) {
      const key = `${dk}::${a.brandId}::${a.processId}`;
      const list = workerMap.get(key) ?? [];
      list.push({ name: e.employee.name, isBackup: a.isBackup });
      workerMap.set(key, list);
    }
  }

  const coverageCells: BrandCoverageCell[] = data.demand.map((slot) => {
    const workers =
      workerMap.get(`${slot.dateKey}::${slot.brandId}::${slot.processId}`) ??
      [];
    return {
      dateKey: slot.dateKey,
      brandId: slot.brandId,
      processId: slot.processId,
      isOperatingDay: slot.isOperatingDay,
      requiredStaff: slot.requiredStaff,
      actualStaff: workers.length,
      workers,
    };
  });

  return (
    <BrandViewClient
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
      brands={data.brands.map((b) => {
        const distinctPrimaries = new Set(
          b.assignments
            .filter((a) => a.allocationType === "PRIMARY")
            .map((a) => a.employeeId)
        );
        return {
          id: b.id,
          name: b.name,
          code: b.code,
          category: b.category,
          isMultiResource: distinctPrimaries.size > 1,
          assignedStaff: b.assignments.map((a) => ({
            employeeId: a.employeeId,
            employeeName: a.employee.name,
            processCode: a.process.code,
            allocationType: a.allocationType,
          })),
          processRules: b.processConfigs.map((c) => ({
            processId: c.processId,
            processCode: c.process.code,
            processName: c.process.name,
            operatingRule: c.operatingRule,
            minStaff: c.minStaff,
          })),
        };
      })}
      coverageCells={coverageCells}
    />
  );
}
