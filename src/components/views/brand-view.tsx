"use client";

import { useState } from "react";
import { Store, AlertTriangle, CheckCircle2 } from "lucide-react";
import { RosterSwitcher, type RosterOption } from "@/components/roster-switcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DAY_SHORT_NAMES,
  formatMonthYear,
  getOperatingRuleLabel,
} from "@/lib/utils";

export interface BrandViewItem {
  id: string;
  name: string;
  code: string;
  category: string | null;
  isMultiResource: boolean;
  assignedStaff: Array<{
    employeeId: string;
    employeeName: string;
    processCode: string;
    allocationType: string;
  }>;
  processRules: Array<{
    processId: string;
    processCode: string;
    processName: string;
    operatingRule: string;
    minStaff: number;
  }>;
}

export interface BrandCoverageCell {
  dateKey: string;
  brandId: string;
  processId: string;
  isOperatingDay: boolean;
  requiredStaff: number;
  actualStaff: number;
  workers: Array<{ name: string; isBackup: boolean }>;
}

export function BrandViewClient({
  roster,
  allRosters,
  calendar,
  brands,
  coverageCells,
}: {
  roster: { id: string; month: number; year: number; status: string };
  allRosters: RosterOption[];
  calendar: Array<{
    dateKey: string;
    dayOfMonth: number;
    dayOfWeek: number;
    globalHolidayName: string | null;
  }>;
  brands: BrandViewItem[];
  coverageCells: BrandCoverageCell[];
}) {
  const [topologyFilter, setTopologyFilter] = useState("ALL");
  const filteredBrands = brands.filter((b) => {
    if (topologyFilter === "SINGLE") return !b.isMultiResource;
    if (topologyFilter === "MULTI") return b.isMultiResource;
    return true;
  });

  const [selectedBrandId, setSelectedBrandId] = useState(
    brands[0]?.id ?? ""
  );

  const selectedBrand =
    filteredBrands.find((b) => b.id === selectedBrandId) ??
    filteredBrands[0] ??
    brands[0];

  const cellMap = new Map(
    coverageCells
      .filter((c) => c.brandId === selectedBrand?.id)
      .map((c) => [`${c.processId}::${c.dateKey}`, c])
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
            <Store className="h-5 w-5 text-blue-600" />
            Brand-Wise Coverage — {formatMonthYear(roster.month, roster.year)}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Inspect client operating rules, assigned agents, and daily required vs. actual process coverage per brand.
          </p>
        </div>
        <RosterSwitcher rosters={allRosters} activeRosterId={roster.id} />
      </div>

      {/* Brand Picker & Topology Filter */}
      <Card>
        <CardContent className="pt-5 flex flex-wrap items-center gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-500">
              Staffing Topology
            </label>
            <Select
              value={topologyFilter}
              onValueChange={(v) => {
                setTopologyFilter(v);
              }}
            >
              <SelectTrigger className="w-52 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Brands ({brands.length})</SelectItem>
                <SelectItem value="SINGLE">
                  Single-Resource ({brands.filter((b) => !b.isMultiResource).length})
                </SelectItem>
                <SelectItem value="MULTI">
                  Multi-Resource ({brands.filter((b) => b.isMultiResource).length})
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[240px]">
            <label className="text-xs font-medium text-slate-500">
              Select Brand
            </label>
            <Select
              value={selectedBrand?.id}
              onValueChange={setSelectedBrandId}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filteredBrands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} ({b.code}) —{" "}
                    {b.isMultiResource ? "Multi-Resource" : "Single-Resource"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {selectedBrand && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Process Operating Rules ({selectedBrand.code})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {selectedBrand.processRules.map((pr) => (
                  <div
                    key={pr.processId}
                    className="flex items-center justify-between rounded border bg-slate-50 px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-mono font-semibold text-blue-700 mr-2">
                        {pr.processCode}
                      </span>
                      <span className="text-slate-700">
                        {getOperatingRuleLabel(pr.operatingRule)}
                      </span>
                    </div>
                    <span className="font-mono text-slate-600">
                      Min: {pr.minStaff}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Assigned Team</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {selectedBrand.assignedStaff.map((s, idx) => (
                  <div
                    key={idx}
                    className={`rounded-md border px-2.5 py-1.5 text-xs ${
                      s.allocationType === "PRIMARY"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-cyan-50 border-cyan-200 text-cyan-900"
                    }`}
                  >
                    <span className="font-medium">{s.employeeName}</span>
                    <span className="ml-1.5 font-mono text-[10px] opacity-80">
                      {s.processCode} ({s.allocationType})
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Daily Coverage Matrix (Actual / Required Staff)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto border-t">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="sticky left-0 z-20 bg-slate-50 text-left px-3 py-2 font-semibold text-slate-700 min-w-[160px] border-r">
                        Process
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
                  </thead>
                  <tbody>
                    {selectedBrand.processRules.map((pr) => (
                      <tr key={pr.processId} className="border-b">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 border-r">
                          <div className="font-mono font-semibold text-blue-700">
                            {pr.processCode}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {pr.processName}
                          </div>
                        </td>
                        {calendar.map((day) => {
                          const cell = cellMap.get(
                            `${pr.processId}::${day.dateKey}`
                          );
                          if (!cell || !cell.isOperatingDay) {
                            return (
                              <td
                                key={day.dateKey}
                                className="p-1 text-center border-r bg-slate-50 text-[10px] text-slate-400 font-mono"
                              >
                                OFF
                              </td>
                            );
                          }

                          const met = cell.actualStaff >= cell.requiredStaff;
                          const hasBackup = cell.workers.some((w) => w.isBackup);
                          return (
                            <td
                              key={day.dateKey}
                              className="p-1 text-center border-r"
                              title={
                                cell.workers.length > 0
                                  ? cell.workers
                                      .map(
                                        (w) =>
                                          `${w.name}${w.isBackup ? " (Backup)" : ""}`
                                      )
                                      .join(", ")
                                  : "No employee covering!"
                              }
                            >
                              <div
                                className={`inline-flex items-center justify-center gap-0.5 rounded px-1.5 py-1 font-mono text-[10px] font-semibold border ${
                                  met
                                    ? hasBackup
                                      ? "bg-cyan-50 text-cyan-800 border-cyan-200"
                                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-red-50 text-red-700 border-red-300 ring-1 ring-red-400"
                                }`}
                              >
                                {met ? (
                                  <CheckCircle2 className="h-2.5 w-2.5" />
                                ) : (
                                  <AlertTriangle className="h-2.5 w-2.5" />
                                )}
                                {cell.actualStaff}/{cell.requiredStaff}
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
        </>
      )}
    </div>
  );
}
