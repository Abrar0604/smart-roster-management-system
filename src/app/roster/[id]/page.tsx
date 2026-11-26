import { notFound } from "next/navigation";
import { getRosterWorkspaceData } from "@/lib/queries/roster-queries";
import { toDateKey } from "@/lib/utils";
import { RosterEditor } from "@/components/roster/roster-editor";

export const dynamic = "force-dynamic";

export default async function RosterEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getRosterWorkspaceData({ rosterId: id });

  if (!data.roster) {
    notFound();
  }

  return (
    <RosterEditor
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
          role: e.role,
          podId: e.podId,
          podName: e.pod.name,
          primaryBrandCodes: Array.from(
            new Set(
              e.assignments
                .filter((a) => a.allocationType === "PRIMARY")
                .map((a) => a.brand.code)
            )
          ),
        }))}
      pods={data.pods.map((p) => ({ id: p.id, name: p.name }))}
      entries={data.roster.entries.map((e) => ({
        id: e.id,
        dateKey: toDateKey(e.date),
        employeeId: e.employeeId,
        status: e.status,
        shiftWindow: e.shiftWindow,
        isManualOverride: e.isManualOverride,
        overrideReason: e.overrideReason,
        allocations: e.allocations.map((a) => ({
          brandId: a.brandId,
          brandCode: a.brand.code,
          brandName: a.brand.name,
          processId: a.processId,
          processCode: a.process.code,
          isBackup: a.isBackup,
          shiftWindow: a.shiftWindow,
        })),
      }))}
      conflicts={data.parsedConflicts.map((c) => ({
        id: c.id,
        dateKey: c.dateKey,
        severity: c.severity,
        conflictType: c.conflictType,
        description: c.description,
        employeeId: c.employeeId,
        brandId: c.brandId,
        processId: c.processId,
        suggestions: c.parsedSuggestions,
      }))}
      changeLogs={data.roster.changeLogs.map((l) => ({
        id: l.id,
        actionType: l.actionType,
        summary: l.summary,
        createdAt: l.createdAt.toISOString(),
      }))}
      coverageStats={data.coverageStats}
      brandProcessOptions={data.configs.map((c) => ({
        brandId: c.brandId,
        brandName: c.brand.name,
        brandCode: c.brand.code,
        processId: c.processId,
        processCode: c.process.code,
      }))}
    />
  );
}
