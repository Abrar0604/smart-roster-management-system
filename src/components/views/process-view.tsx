"use client";

import { useState } from "react";
import { Workflow, AlertTriangle, CheckCircle2 } from "lucide-react";
import { RosterSwitcher, type RosterOption } from "@/components/roster-switcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DAY_SHORT_NAMES, formatMonthYear } from "@/lib/utils";

export interface ProcessSlotCell {
  dateKey: string;
  brandId: string;
  processId: string;
  isOperatingDay: boolean;
  requiredStaff: number;
  actualStaff: number;
  workerNames: string[];
}

export function ProcessViewClient({
  roster,
  allRosters,
  calendar,
  processes,
  brandsByProcess,
  slots,
}: {
  roster: { id: string; month: number; year: number; status: string };
  allRosters: RosterOption[];
  calendar: Array<{
    dateKey: string;
    dayOfMonth: number;
    dayOfWeek: number;
    globalHolidayName: string | null;
  }>;
  processes: Array<{ id: string; code: string; name: string }>;
  brandsByProcess: Record<
    string,
    Array<{ id: string; name: string; code: string; operatingRule: string }>
  >;
  slots: ProcessSlotCell[];
}) {
  const [selectedProcessId, setSelectedProcessId] = useState(
    processes[0]?.id ?? ""
  );

  const activeProcess =
    processes.find((p) => p.id === selectedProcessId) ?? processes[0];
  const brandsForProc = brandsByProcess[activeProcess?.id ?? ""] ?? [];

  const slotMap = new Map(
    slots
      .filter((s) => s.processId === activeProcess?.id)
      .map((s) => [`${s.brandId}::${s.dateKey}`, s])
  );

  // Aggregate daily totals for active process
  const dailyTotals = calendar.map((day) => {
    let required = 0;
    let actual = 0;
    let gaps = 0;
    for (const b of brandsForProc) {
      const s = slotMap.get(`${b.id}::${day.dateKey}`);
      if (s && s.isOperatingDay) {
        required += s.requiredStaff;
        actual += s.actualStaff;
        if (s.actualStaff < s.requiredStaff) gaps++;
      }
    }
    return { dateKey: day.dateKey, required, actual, gaps };
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <Workflow className="h-5 w-5 text-blue-600" />
            Process-Wise Staffing — {formatMonthYear(roster.month, roster.year)}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track staffing and operating schedules aggregated across every D2C brand per operational queue.
          </p>
        </div>
        <RosterSwitcher rosters={allRosters} activeRosterId={roster.id} />
      </div>

      <Tabs value={activeProcess?.id} onValueChange={setSelectedProcessId}>
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          {processes.map((p) => (
            <TabsTrigger key={p.id} value={p.id} className="text-xs">
              <span className="font-mono font-semibold mr-1.5">{p.code}</span>
              {p.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {activeProcess && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {activeProcess.code} — {activeProcess.name} (
              {brandsForProc.length} Brands)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto border-t">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="sticky left-0 z-20 bg-slate-50 text-left px-3 py-2 font-semibold text-slate-700 min-w-[200px] border-r">
                      Brand
                    </th>
                    {calendar.map((day) => (
                      <th
                        key={day.dateKey}
                        className={`px-1 py-1.5 text-center font-medium min-w-[40px] border-r ${
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
                  <tr className="bg-blue-50/60 border-b text-[10px]">
                    <th className="sticky left-0 z-20 bg-blue-50 text-left px-3 py-1.5 font-semibold text-blue-900 border-r">
                      Daily Headcount (Actual / Req)
                    </th>
                    {dailyTotals.map((t) => (
                      <th
                        key={t.dateKey}
                        className={`px-1 py-1 text-center font-mono border-r ${
                          t.gaps > 0
                            ? "text-red-700 bg-red-50"
                            : "text-blue-800"
                        }`}
                      >
                        {t.actual}/{t.required}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {brandsForProc.map((brand) => (
                    <tr key={brand.id} className="border-b hover:bg-slate-50/60">
                      <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border-r">
                        <div className="font-medium text-slate-900">
                          {brand.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {brand.code} • {brand.operatingRule}
                        </div>
                      </td>
                      {calendar.map((day) => {
                        const s = slotMap.get(`${brand.id}::${day.dateKey}`);
                        if (!s || !s.isOperatingDay) {
                          return (
                            <td
                              key={day.dateKey}
                              className="p-1 text-center border-r bg-slate-50 text-[10px] text-slate-400 font-mono"
                            >
                              —
                            </td>
                          );
                        }
                        const met = s.actualStaff >= s.requiredStaff;
                        return (
                          <td
                            key={day.dateKey}
                            className="p-1 text-center border-r"
                            title={
                              s.workerNames.length > 0
                                ? s.workerNames.join(", ")
                                : "Uncovered"
                            }
                          >
                            <span
                              className={`inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-mono text-[10px] font-semibold border ${
                                met
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-red-50 text-red-700 border-red-300"
                              }`}
                            >
                              {met ? (
                                <CheckCircle2 className="h-2.5 w-2.5" />
                              ) : (
                                <AlertTriangle className="h-2.5 w-2.5" />
                              )}
                              {s.actualStaff}/{s.requiredStaff}
                            </span>
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
      )}
    </div>
  );
}
