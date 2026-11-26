import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCog,
  CheckCircle2,
  Download,
  Layers,
  ShieldAlert,
  Store,
  UserCheck,
  Workflow,
} from "lucide-react";
import { getRosterWorkspaceData } from "@/lib/queries/roster-queries";
import { formatMonthYear } from "@/lib/utils";
import { SeverityBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ rosterId?: string }>;
}) {
  const sp = await searchParams;
  const data = await getRosterWorkspaceData({ rosterId: sp.rosterId });

  const activeEmployeesCount = data.employees.filter((e) => e.active).length;
  const singleResourceBrands = data.brands.filter((b) => {
    const primaries = new Set(
      b.assignments
        .filter((a) => a.allocationType === "PRIMARY")
        .map((a) => a.employeeId)
    );
    return primaries.size <= 1;
  }).length;
  const multiResourceBrands = data.brands.length - singleResourceBrands;

  // Group conflicts by type
  const conflictCountsByType = new Map<string, number>();
  for (const c of data.parsedConflicts) {
    conflictCountsByType.set(
      c.conflictType,
      (conflictCountsByType.get(c.conflictType) ?? 0) + 1
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Operations Control Center
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data.roster
              ? `${formatMonthYear(data.roster.month, data.roster.year)} (${data.roster.status}) — real-time coverage, conflict diagnostics, and stakeholder views.`
              : "No monthly roster generated yet. Generate your first roster to inspect coverage."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link href="/roster/generate">
              <CalendarCog className="h-4 w-4" />
              Generate Roster
            </Link>
          </Button>
          {data.roster && (
            <>
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a
                  href={`/api/roster/export?rosterId=${data.roster.id}&format=xlsx`}
                >
                  <Download className="h-4 w-4" />
                  Export Excel
                </a>
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <Link href={`/roster/${data.roster.id}`}>
                  Open Interactive Editor
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs font-medium text-slate-500">
              Client Demand Coverage
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-1 text-emerald-700">
              {data.coverageStats.coveragePercent}%
            </div>
            <div className="text-xs text-slate-500 mt-1 tabular-nums">
              {data.coverageStats.coveredDemandSlots} /{" "}
              {data.coverageStats.totalDemandSlots} required slots filled
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="text-xs font-medium text-slate-500">
              Team & Pod Structure
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-1 text-slate-900">
              {activeEmployeesCount} Employees
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Across {data.pods.length} operational pods & {data.processes.length}{" "}
              processes
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="text-xs font-medium text-slate-500">
              Brand Staffing Topology
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-1 text-slate-900">
              {data.brands.length} Brands
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {singleResourceBrands} single-resource (
              {data.brands.length
                ? Math.round((singleResourceBrands / data.brands.length) * 100)
                : 0}
              %) • {multiResourceBrands} multi-resource
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <div className="text-xs font-medium text-slate-500">
              Constraint Diagnostics
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-2xl font-semibold tabular-nums ${
                  data.coverageStats.hardConflicts > 0
                    ? "text-red-600"
                    : "text-emerald-700"
                }`}
              >
                {data.coverageStats.hardConflicts} Hard
              </span>
              <span className="text-sm font-medium text-amber-700 tabular-nums">
                / {data.coverageStats.softConflicts} Soft
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {data.coverageStats.hardConflicts > 0
                ? "Requires backup or override before publish"
                : "All mandatory constraints satisfied"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stakeholder Views Quick Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          {
            href: "/views/company",
            title: "Company-Wide",
            desc: "All pods & employees",
            icon: Building2,
          },
          {
            href: "/views/pod",
            title: "Pod-Wise",
            desc: "Team & fairness stats",
            icon: Layers,
          },
          {
            href: "/views/brand",
            title: "Brand-Wise",
            desc: "Required vs actual staff",
            icon: Store,
          },
          {
            href: "/views/process",
            title: "Process-Wise",
            desc: "CS / ACC / NDR / RET",
            icon: Workflow,
          },
          {
            href: "/views/employee",
            title: "Employee-Wise",
            desc: "Personal month calendar",
            icon: UserCheck,
          },
        ].map((view) => {
          const Icon = view.icon;
          return (
            <Link
              key={view.href}
              href={
                data.roster ? `${view.href}?rosterId=${data.roster.id}` : view.href
              }
              className="group rounded-lg border bg-white p-4 hover:border-blue-400 hover:shadow-xs transition-all"
            >
              <div className="flex items-center justify-between">
                <Icon className="h-4 w-4 text-blue-600" />
                <ArrowRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-blue-600 transition-colors" />
              </div>
              <div className="font-semibold text-sm text-slate-900 mt-2.5">
                {view.title}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{view.desc}</div>
            </Link>
          );
        })}
      </div>

      {/* Active Conflicts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <Card className="lg:col-span-7">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              Top Active Conflicts & Gaps
            </CardTitle>
            {data.roster && (
              <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                <Link href={`/roster/${data.roster.id}`}>
                  Resolve in Editor
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from(conflictCountsByType.entries()).length > 0 && (
              <div className="flex flex-wrap gap-2 pb-2 border-b">
                {Array.from(conflictCountsByType.entries()).map(
                  ([type, count]) => (
                    <span
                      key={type}
                      className="inline-flex items-center gap-1.5 rounded bg-slate-100 px-2 py-1 text-[11px] font-mono text-slate-700"
                    >
                      {type}: <strong>{count}</strong>
                    </span>
                  )
                )}
              </div>
            )}

            {data.parsedConflicts.length === 0 ? (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Zero conflicts detected in the current roster.
              </div>
            ) : (
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {data.parsedConflicts.slice(0, 12).map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-md border p-3 text-xs space-y-1 ${
                      c.severity === "HARD"
                        ? "bg-red-50/40 border-red-200"
                        : "bg-amber-50/40 border-amber-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <SeverityBadge severity={c.severity} />
                      <span className="font-mono text-[11px] text-slate-500">
                        {c.dateKey} • {c.conflictType}
                      </span>
                    </div>
                    <p className="text-slate-800">{c.description}</p>
                    {c.parsedSuggestions.length > 0 && (
                      <div className="text-[11px] text-blue-700 font-medium">
                        Suggested backup: {c.parsedSuggestions[0].employeeName}{" "}
                        ({c.parsedSuggestions[0].reason})
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-slate-500" />
              Recent Scheduling & Change Audit Log
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5 max-h-[390px] overflow-y-auto">
            {!data.roster || data.roster.changeLogs.length === 0 ? (
              <p className="text-xs text-slate-500">No activity recorded yet.</p>
            ) : (
              data.roster.changeLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded border bg-slate-50/70 p-2.5 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                      {log.actionType}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400">
                      {log.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </span>
                  </div>
                  <p className="text-slate-700">{log.summary}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
