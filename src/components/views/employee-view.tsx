"use client";

import { useState } from "react";
import { UserCheck } from "lucide-react";
import { EntryStatusPill, RoleBadge } from "@/components/status-badge";
import { RosterSwitcher, type RosterOption } from "@/components/roster-switcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DAY_NAMES, formatMonthYear } from "@/lib/utils";

export interface EmployeeViewProfile {
  id: string;
  name: string;
  email: string | null;
  role: string;
  podName: string;
  shiftWindow: string;
  maxWeeklyWorkdays: number;
  preferredOffDay: number | null;
  assignments: Array<{
    brandCode: string;
    brandName: string;
    processCode: string;
    allocationType: string;
  }>;
}

export interface EmployeeViewEntry {
  dateKey: string;
  employeeId: string;
  status: string;
  overrideReason: string | null;
  allocations: Array<{
    brandCode: string;
    brandName: string;
    processCode: string;
    isBackup: boolean;
  }>;
}

export function EmployeeViewClient({
  roster,
  allRosters,
  calendar,
  employees,
  entries,
  initialEmployeeId,
}: {
  roster: { id: string; month: number; year: number; status: string };
  allRosters: RosterOption[];
  calendar: Array<{
    dateKey: string;
    dayOfMonth: number;
    dayOfWeek: number;
    globalHolidayName: string | null;
  }>;
  employees: EmployeeViewProfile[];
  entries: EmployeeViewEntry[];
  initialEmployeeId?: string;
}) {
  const [selectedEmpId, setSelectedEmpId] = useState(
    employees.find((e) => e.id === initialEmployeeId)?.id ??
      employees[0]?.id ??
      ""
  );

  const emp = employees.find((e) => e.id === selectedEmpId) ?? employees[0];
  const empEntries = entries.filter((e) => e.employeeId === emp?.id);
  const entryMap = new Map(empEntries.map((e) => [e.dateKey, e]));

  const workingCount = empEntries.filter((e) => e.status === "WORKING").length;
  const offCount = empEntries.filter((e) => e.status === "WEEKLY_OFF").length;
  const holidayCount = empEntries.filter(
    (e) => e.status === "PUBLIC_HOLIDAY"
  ).length;
  const leaveCount = empEntries.filter(
    (e) =>
      e.status === "PLANNED_LEAVE" ||
      e.status === "COMP_OFF" ||
      e.status === "UNAVAILABLE"
  ).length;

  // Compute Monday-aligned padding for the 7-col monthly calendar
  const firstDowMon0 =
    calendar.length > 0 ? (calendar[0].dayOfWeek + 6) % 7 : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-blue-600" />
            Employee-Wise Schedule — {formatMonthYear(roster.month, roster.year)}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Individual working days, weekly offs, public holidays, leaves, and assigned D2C brand queues.
          </p>
        </div>
        <RosterSwitcher rosters={allRosters} activeRosterId={roster.id} />
      </div>

      <Card>
        <CardContent className="pt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-[260px]">
            <label className="text-xs font-medium text-slate-500">
              Select Employee
            </label>
            <Select value={emp?.id} onValueChange={setSelectedEmpId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} — {e.podName.split("—")[0]} ({e.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {emp && (
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <RoleBadge role={emp.role} />
              <span className="text-slate-600">
                Pod: <strong className="text-slate-900">{emp.podName}</strong>
              </span>
              <span className="text-slate-600">
                Shift:{" "}
                <strong className="font-mono text-slate-900">
                  {emp.shiftWindow}
                </strong>
              </span>
              <span className="text-slate-600">
                Preferred Off:{" "}
                <strong className="text-slate-900">
                  {emp.preferredOffDay !== null
                    ? DAY_NAMES[emp.preferredOffDay]
                    : "Flexible"}
                </strong>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {emp && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="py-4">
                <div className="text-xs text-slate-500">Working Days</div>
                <div className="text-2xl font-semibold tabular-nums text-emerald-700 mt-0.5">
                  {workingCount}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-xs text-slate-500">Weekly Offs</div>
                <div className="text-2xl font-semibold tabular-nums text-blue-700 mt-0.5">
                  {offCount}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-xs text-slate-500">Public Holidays</div>
                <div className="text-2xl font-semibold tabular-nums text-violet-700 mt-0.5">
                  {holidayCount}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-4">
                <div className="text-xs text-slate-500">Leaves / Comp-Offs</div>
                <div className="text-2xl font-semibold tabular-nums text-orange-700 mt-0.5">
                  {leaveCount}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Assigned Accounts & Processes</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {emp.assignments.length === 0 ? (
                <span className="text-xs text-slate-500">
                  Pod-level float pool (no fixed brand assignment)
                </span>
              ) : (
                emp.assignments.map((a, idx) => (
                  <span
                    key={idx}
                    className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs ${
                      a.allocationType === "PRIMARY"
                        ? "bg-slate-50 border-slate-200 text-slate-800"
                        : "bg-cyan-50 border-cyan-200 text-cyan-900"
                    }`}
                  >
                    <strong className="font-mono">{a.brandCode}</strong>
                    <span>{a.brandName}</span>
                    <span className="font-mono text-[11px] text-blue-700 font-semibold">
                      {a.processCode}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ({a.allocationType})
                    </span>
                  </span>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Monthly Calendar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 text-xs">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (label) => (
                    <div
                      key={label}
                      className="text-center font-semibold text-slate-500 py-1"
                    >
                      {label}
                    </div>
                  )
                )}
                {Array.from({ length: firstDowMon0 }).map((_, idx) => (
                  <div key={`pad-${idx}`} className="min-h-[86px] rounded bg-slate-50/60" />
                ))}
                {calendar.map((day) => {
                  const entry = entryMap.get(day.dateKey);
                  return (
                    <div
                      key={day.dateKey}
                      className={`min-h-[86px] rounded-md border p-2 flex flex-col justify-between gap-1 ${
                        day.globalHolidayName
                          ? "border-violet-200 bg-violet-50/30"
                          : "bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-slate-700 tabular-nums">
                          {day.dayOfMonth}
                        </span>
                        {entry && <EntryStatusPill status={entry.status} compact />}
                      </div>
                      <div className="space-y-0.5">
                        {entry?.allocations.slice(0, 3).map((a, idx) => (
                          <div
                            key={idx}
                            className={`text-[10px] font-mono px-1 py-0.5 rounded truncate ${
                              a.isBackup
                                ? "bg-cyan-50 text-cyan-800 border border-cyan-200"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {a.isBackup ? "BK:" : ""}
                            {a.brandCode}:{a.processCode}
                          </div>
                        ))}
                        {entry && entry.allocations.length > 3 && (
                          <div className="text-[10px] text-slate-400">
                            +{entry.allocations.length - 3} more
                          </div>
                        )}
                        {entry?.overrideReason && entry.status !== "WORKING" && (
                          <div className="text-[10px] text-slate-500 truncate">
                            {entry.overrideReason}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
