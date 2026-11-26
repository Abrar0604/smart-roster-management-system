import Link from "next/link";
import { getRosterWorkspaceData } from "@/lib/queries/roster-queries";
import { toDateKey } from "@/lib/utils";
import {
  ProcessViewClient,
  type ProcessSlotCell,
} from "@/components/views/process-view";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ProcessViewPage({
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

  const workerMap = new Map<string, string[]>();
  for (const e of data.roster.entries) {
    if (e.status !== "WORKING") continue;
    const dk = toDateKey(e.date);
    for (const a of e.allocations) {
      const k = `${dk}::${a.brandId}::${a.processId}`;
      const list = workerMap.get(k) ?? [];
      list.push(`${e.employee.name}${a.isBackup ? " (Backup)" : ""}`);
      workerMap.set(k, list);
    }
  }

  const brandsByProcess: Record<
    string,
    Array<{ id: string; name: string; code: string; operatingRule: string }>
  > = {};
  for (const c of data.configs) {
    if (!c.active) continue;
    const list = brandsByProcess[c.processId] ?? [];
    list.push({
      id: c.brand.id,
      name: c.brand.name,
      code: c.brand.code,
      operatingRule: c.operatingRule,
    });
    brandsByProcess[c.processId] = list;
  }

  const slots: ProcessSlotCell[] = data.demand.map((s) => {
    const names =
      workerMap.get(`${s.dateKey}::${s.brandId}::${s.processId}`) ?? [];
    return {
      dateKey: s.dateKey,
      brandId: s.brandId,
      processId: s.processId,
      isOperatingDay: s.isOperatingDay,
      requiredStaff: s.requiredStaff,
      actualStaff: names.length,
      workerNames: names,
    };
  });

  return (
    <ProcessViewClient
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
      processes={data.processes.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
      }))}
      brandsByProcess={brandsByProcess}
      slots={slots}
    />
  );
}
