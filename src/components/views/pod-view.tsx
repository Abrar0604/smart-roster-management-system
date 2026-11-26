"use client";

import Link from "next/link";
import { useState } from "react";
import { Layers, Download } from "lucide-react";
import { EntryStatusPill, RoleBadge } from "@/components/status-badge";
import { RosterSwitcher, type RosterOption } from "@/components/roster-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EmployeeFairnessStat } from "@/lib/scheduler/fairness";
import { DAY_SHORT_NAMES, formatMonthYear } from "@/lib/utils";

export function PodViewClient({
  roster,
  allRosters,
  calendar,
  pods,
  employees,
  entries,
  fairnessStats,
  podConflictCounts,
}: {
  roster: { id: string; month: number; year: number; status: string };
  allRosters: RosterOption[];
  calendar: Array<{
    dateKey: string;
    dayOfMonth: number;
    dayOfWeek: number;
    globalHolidayName: string | null;
  }>;
  pods: Array<{ id: string; name: string; leadName: string | null }>;
  employees: Array<{
    id: string;
    name: string;
    role: string;
    podId: string;
    primaryBrands: string[];
  }>;
  entries: Array<{
    employeeId: string;
    dateKey: string;
    status: string;
    allocSummary: string;
  }>;
  fairnessStats: EmployeeFairnessStat[];
  podConflictCounts: Record<string, number>;
}) {
  const [selectedPodId, setSelectedPodId] = useState(pods[0]?.id ?? "");

  const selectedPod = pods.find((p) => p.id === selectedPodId) ?? pods[0];
  const podEmployees = employees.filter((e) => e.podId === selectedPod?.id);
  const podFairness = fairnessStats.filter((f) => f.podId === selectedPod?.id);

  const entryMap = new Map(
    entries.map((e) => [`${e.employeeId}::${e.dateKey}`, e])
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-blue-600" />
            Pod-Wise View — {formatMonthYear(roster.month, roster.year)}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Schedules, weekly-off fairness, and team capacity overseen by each Pod Lead.
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
        </div>
      </div>

      <Tabs value={selectedPod?.id} onValueChange={setSelectedPodId}>
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          {pods.map((p) => (
            <TabsTrigger key={p.id} value={p.id} className="text-xs">
              {p.name.split("—")[0].trim()}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {selectedPod && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-5">
                <div className="text-xs text-slate-500">Pod Lead</div>
                <div className="text-base font-semibold mt-1 text-slate-900">
                  {selectedPod.leadName ?? "Unassigned"}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-xs text-slate-500">Pod Headcount</div>
                <div className="text-base font-semibold tabular-nums mt-1">
                  {podEmployees.length} active members
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5">
                <div className="text-xs text-slate-500">Hard Conflicts in Pod</div>
                <div
                  className={`text-base font-semibold tabular-nums mt-1 ${
                    (podConflictCounts[selectedPod.id] ?? 0) > 0
                      ? "text-red-600"
                      : "text-emerald-700"
                  }`}
                >
                  {podConflictCounts[selectedPod.id] ?? 0}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{selectedPod.name} — Monthly Grid</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto border-t">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="sticky left-0 z-20 bg-slate-50 text-left px-3 py-2 font-semibold text-slate-700 min-w-[245px] border-r">
                        Employee
                      </th>
                      {calendar.map((day) => (
                        <th
                          key={day.dateKey}
                          className={`px-1 py-1.5 text-center font-medium min-w-[36px] border-r ${
                            day.globalHolidayName
                              ? "bg-violet-50 text-violet-800"
                              : day.dayOfWeek === 0
                                ? "bg-slate-100"
                                : ""
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
                    {podEmployees.map((emp) => (
                      <tr key={emp.id} className="border-b hover:bg-slate-50/60">
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
                            {emp.primaryBrands.join(", ") || "Backup Float"}
                          </div>
                        </td>
                        {calendar.map((day) => {
                          const entry = entryMap.get(`${emp.id}::${day.dateKey}`);
                          return (
                            <td
                              key={day.dateKey}
                              className="p-0.5 text-center border-r"
                              title={entry?.allocSummary || entry?.status}
                            >
                              {entry ? (
                                <EntryStatusPill status={entry.status} compact />
                              ) : (
                                "—"
                              )}
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Pod Workload & Weekly-Off Fairness Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Working Days</TableHead>
                    <TableHead>Weekly Offs</TableHead>
                    <TableHead>Sunday Offs</TableHead>
                    <TableHead>Preferred Off Matches</TableHead>
                    <TableHead>Max Streak</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {podFairness.map((f) => (
                    <TableRow key={f.employeeId}>
                      <TableCell className="font-medium text-slate-900">
                        {f.employeeName}
                      </TableCell>
                      <TableCell className="tabular-nums font-mono text-xs">
                        {f.totalWorkingDays}
                      </TableCell>
                      <TableCell className="tabular-nums font-mono text-xs">
                        {f.totalWeeklyOffs}
                      </TableCell>
                      <TableCell className="tabular-nums font-mono text-xs">
                        {f.sundayOffs}
                      </TableCell>
                      <TableCell className="tabular-nums font-mono text-xs">
                        {f.preferredOffMatches}
                      </TableCell>
                      <TableCell className="tabular-nums font-mono text-xs">
                        <span
                          className={
                            f.maxConsecutiveWorkdays > 7
                              ? "text-amber-700 font-semibold"
                              : ""
                          }
                        >
                          {f.maxConsecutiveWorkdays} days
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
