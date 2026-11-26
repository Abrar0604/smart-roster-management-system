"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Download, PencilLine, AlertTriangle } from "lucide-react";
import { EntryStatusPill, RoleBadge } from "@/components/status-badge";
import { RosterSwitcher, type RosterOption } from "@/components/roster-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAY_SHORT_NAMES, formatMonthYear } from "@/lib/utils";

export function CompanyViewClient({
  roster,
  allRosters,
  calendar,
  pods,
  employees,
  entries,
  hardConflictCellKeys,
  coverageStats,
}: {
  roster: { id: string; month: number; year: number; status: string };
  allRosters: RosterOption[];
  calendar: Array<{
    dateKey: string;
    dayOfMonth: number;
    dayOfWeek: number;
    globalHolidayName: string | null;
  }>;
  pods: Array<{ id: string; name: string }>;
  employees: Array<{
    id: string;
    name: string;
    role: string;
    podId: string;
    podName: string;
    primaryBrands: string[];
  }>;
  entries: Array<{
    employeeId: string;
    dateKey: string;
    status: string;
    allocSummary: string;
    hasBackup: boolean;
  }>;
  hardConflictCellKeys: string[];
  coverageStats: {
    totalDemandSlots: number;
    coveredDemandSlots: number;
    coveragePercent: number;
    hardConflicts: number;
    softConflicts: number;
  };
}) {
  const [podFilter, setPodFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const entryMap = new Map(
    entries.map((e) => [`${e.employeeId}::${e.dateKey}`, e])
  );
  const conflictSet = new Set(hardConflictCellKeys);

  const filtered = employees.filter((e) => {
    const matchPod = podFilter === "ALL" || e.podId === podFilter;
    const matchSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.primaryBrands.some((b) =>
        b.toLowerCase().includes(search.toLowerCase())
      );
    return matchPod && matchSearch;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Company-Wide Roster — {formatMonthYear(roster.month, roster.year)}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Complete monthly staffing grid across all operational pods and D2C client accounts.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RosterSwitcher rosters={allRosters} activeRosterId={roster.id} />
          <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <a href={`/api/roster/export?rosterId=${roster.id}&format=csv`}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </a>
          </Button>
          <Button asChild size="sm" className="h-8 text-xs gap-1.5">
            <Link href={`/roster/${roster.id}`}>
              <PencilLine className="h-3.5 w-3.5" />
              Edit Roster
            </Link>
          </Button>
        </div>
      </div>

      {/* Coverage Banner */}
      <div className="rounded-lg border bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <span className="text-slate-500">Demand Slots Covered:</span>{" "}
            <span className="font-semibold font-mono text-emerald-700">
              {coverageStats.coveredDemandSlots}/{coverageStats.totalDemandSlots} (
              {coverageStats.coveragePercent}%)
            </span>
          </div>
          <div>
            <span className="text-slate-500">Hard Conflicts:</span>{" "}
            <span
              className={`font-semibold font-mono ${
                coverageStats.hardConflicts > 0
                  ? "text-red-600"
                  : "text-emerald-700"
              }`}
            >
              {coverageStats.hardConflicts}
            </span>
          </div>
          <div>
            <span className="text-slate-500">Soft Preference Notices:</span>{" "}
            <span className="font-semibold font-mono text-amber-700">
              {coverageStats.softConflicts}
            </span>
          </div>
        </div>
        {coverageStats.hardConflicts > 0 && (
          <Link
            href={`/roster/${roster.id}`}
            className="inline-flex items-center gap-1 text-red-600 font-medium hover:underline"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Review gaps in Interactive Editor
          </Link>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base">
            All Employees ({filtered.length})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search employee or brand..."
              className="w-52 h-8 text-xs"
            />
            <Select value={podFilter} onValueChange={setPodFilter}>
              <SelectTrigger className="w-52 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Operational Pods</SelectItem>
                {pods.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="sticky left-0 z-20 bg-slate-50 text-left px-3 py-2 font-semibold text-slate-700 min-w-[245px] border-r">
                    Employee & Role
                  </th>
                  <th className="text-left px-2.5 py-2 font-semibold text-slate-700 min-w-[130px] border-r">
                    Pod
                  </th>
                  {calendar.map((day) => (
                    <th
                      key={day.dateKey}
                      className={`px-1 py-1.5 text-center font-medium min-w-[36px] border-r ${
                        day.globalHolidayName
                          ? "bg-violet-50 text-violet-800"
                          : day.dayOfWeek === 0
                            ? "bg-slate-100 text-slate-700"
                            : "text-slate-600"
                      }`}
                    >
                      <div className="tabular-nums font-semibold">
                        {day.dayOfMonth}
                      </div>
                      <div className="text-[9px] uppercase">
                        {DAY_SHORT_NAMES[day.dayOfWeek]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.id} className="border-b hover:bg-slate-50/70">
                    <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border-r">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/views/employee?rosterId=${roster.id}&employeeId=${emp.id}`}
                          className="font-medium text-slate-900 hover:text-blue-700 hover:underline truncate"
                        >
                          {emp.name}
                        </Link>
                        <RoleBadge role={emp.role} />
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">
                        {emp.primaryBrands.join(", ") || "Float Pool"}
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 text-[11px] text-slate-500 border-r whitespace-nowrap">
                      {emp.podName.split("—")[0]}
                    </td>
                    {calendar.map((day) => {
                      const entry = entryMap.get(`${emp.id}::${day.dateKey}`);
                      if (!entry) {
                        return (
                          <td key={day.dateKey} className="p-1 text-center border-r">
                            —
                          </td>
                        );
                      }
                      return (
                        <td
                          key={day.dateKey}
                          className="p-0.5 text-center border-r"
                          title={`${emp.name} • ${day.dateKey} • ${entry.status}${
                            entry.allocSummary ? ` (${entry.allocSummary})` : ""
                          }`}
                        >
                          <div className="relative inline-flex">
                            <EntryStatusPill
                              status={entry.status}
                              compact
                              hasConflict={conflictSet.has(
                                `${emp.id}::${day.dateKey}`
                              )}
                            />
                            {entry.hasBackup && (
                              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-cyan-500 ring-1 ring-white" />
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
