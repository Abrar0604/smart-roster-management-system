"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UserX,
  Lock,
  Unlock,
} from "lucide-react";
import {
  acceptBackupSuggestionAction,
  revalidateRosterAction,
  simulateUnavailabilityAction,
  togglePublishRosterAction,
  updateRosterEntryAction,
} from "@/app/actions/roster";
import { EntryStatusPill, SeverityBadge } from "@/components/status-badge";
import { RosterSwitcher, type RosterOption } from "@/components/roster-switcher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  BackupCandidate,
  ConflictSuggestion,
  EntryStatus,
  ShiftWindow,
} from "@/lib/types";
import { DAY_SHORT_NAMES, formatMonthYear } from "@/lib/utils";

export interface EditorCalendarDay {
  dateKey: string;
  dayOfMonth: number;
  dayOfWeek: number;
  globalHolidayName: string | null;
}

export interface EditorAllocation {
  brandId: string;
  brandCode: string;
  brandName: string;
  processId: string;
  processCode: string;
  isBackup: boolean;
  shiftWindow: string;
}

export interface EditorEntry {
  id: string;
  dateKey: string;
  employeeId: string;
  status: string;
  shiftWindow: string;
  isManualOverride: boolean;
  overrideReason: string | null;
  allocations: EditorAllocation[];
}

export interface EditorEmployee {
  id: string;
  name: string;
  role: string;
  podId: string;
  podName: string;
  primaryBrandCodes: string[];
}

export interface EditorConflict {
  id: string;
  dateKey: string;
  severity: string;
  conflictType: string;
  description: string;
  employeeId: string | null;
  brandId: string | null;
  processId: string | null;
  suggestions: ConflictSuggestion[];
}

export interface ChangeLogItem {
  id: string;
  actionType: string;
  summary: string;
  createdAt: string;
}

export function RosterEditor({
  roster,
  allRosters,
  calendar,
  employees,
  pods,
  entries,
  conflicts,
  changeLogs,
  coverageStats,
  brandProcessOptions,
}: {
  roster: { id: string; month: number; year: number; status: string };
  allRosters: RosterOption[];
  calendar: EditorCalendarDay[];
  employees: EditorEmployee[];
  pods: Array<{ id: string; name: string }>;
  entries: EditorEntry[];
  conflicts: EditorConflict[];
  changeLogs: ChangeLogItem[];
  coverageStats: {
    totalDemandSlots: number;
    coveredDemandSlots: number;
    coveragePercent: number;
    hardConflicts: number;
    softConflicts: number;
  };
  brandProcessOptions: Array<{
    brandId: string;
    brandName: string;
    brandCode: string;
    processId: string;
    processCode: string;
  }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [podFilter, setPodFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [conflictFilter, setConflictFilter] = useState("ALL");
  const [toast, setToast] = useState<string | null>(null);

  // Cell edit modal state
  const [selectedCell, setSelectedCell] = useState<{
    entry: EditorEntry;
    employee: EditorEmployee;
  } | null>(null);
  const [editStatus, setEditStatus] = useState<EntryStatus>("WORKING");
  const [editShift, setEditShift] = useState<ShiftWindow>("STANDARD");
  const [editReason, setEditReason] = useState("");
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());

  // Change simulator state
  const [simEmployeeId, setSimEmployeeId] = useState(employees[0]?.id ?? "");
  const [simStartDate, setSimStartDate] = useState(
    calendar[13]?.dateKey ?? calendar[0]?.dateKey ?? ""
  );
  const [simEndDate, setSimEndDate] = useState(
    calendar[13]?.dateKey ?? calendar[0]?.dateKey ?? ""
  );
  const [simStatus, setSimStatus] =
    useState<Exclude<EntryStatus, "WORKING">>("PLANNED_LEAVE");
  const [simReason, setSimReason] = useState("Emergency leave request");
  const [simAutoBackup, setSimAutoBackup] = useState(false);
  const [simOutput, setSimOutput] = useState<{
    preservedEntriesCount: number;
    modifiedEntriesCount: number;
    hardConflictsBefore: number;
    hardConflictsAfter: number;
    affectedSlots: Array<{
      dateKey: string;
      brandId: string;
      brandName: string;
      processId: string;
      processCode: string;
      remainingWorkers: number;
      requiredStaff: number;
      backupAssigned: string | null;
      candidates: BackupCandidate[];
    }>;
  } | null>(null);

  const entryLookup = new Map(
    entries.map((e) => [`${e.employeeId}::${e.dateKey}`, e])
  );

  // Build conflict index per employee::dateKey for red outline overlay
  const cellConflictMap = new Map<string, EditorConflict[]>();
  for (const c of conflicts) {
    if (c.employeeId) {
      const k = `${c.employeeId}::${c.dateKey}`;
      const arr = cellConflictMap.get(k) ?? [];
      arr.push(c);
      cellConflictMap.set(k, arr);
    }
  }

  const openCellEditor = (entry: EditorEntry, emp: EditorEmployee) => {
    setSelectedCell({ entry, employee: emp });
    setEditStatus(entry.status as EntryStatus);
    setEditShift(entry.shiftWindow as ShiftWindow);
    setEditReason(entry.overrideReason ?? "");
    setSelectedSlots(
      new Set(entry.allocations.map((a) => `${a.brandId}::${a.processId}`))
    );
  };

  const toggleSlot = (key: string) => {
    const next = new Set(selectedSlots);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedSlots(next);
  };

  const handleSaveCell = () => {
    if (!selectedCell) return;
    startTransition(async () => {
      const allocations =
        editStatus === "WORKING"
          ? Array.from(selectedSlots).map((k) => {
              const [brandId, processId] = k.split("::");
              const prev = selectedCell.entry.allocations.find(
                (a) => a.brandId === brandId && a.processId === processId
              );
              return {
                brandId,
                processId,
                shiftWindow: editShift,
                isBackup: prev?.isBackup ?? false,
                capacityWeight: 0.5,
              };
            })
          : [];

      const res = await updateRosterEntryAction({
        rosterId: roster.id,
        entryId: selectedCell.entry.id,
        status: editStatus,
        shiftWindow: editShift,
        overrideReason: editReason || "Manual edit",
        allocations,
      });
      setSelectedCell(null);
      setToast(
        `Saved edit and re-validated: ${res.hardConflicts} hard, ${res.softConflicts} soft conflict(s).`
      );
      router.refresh();
    });
  };

  const handleAcceptBackup = (s: ConflictSuggestion, dateKey: string) => {
    if (!s.employeeId || !s.brandId || !s.processId) return;
    startTransition(async () => {
      const res = await acceptBackupSuggestionAction({
        rosterId: roster.id,
        dateKey,
        employeeId: s.employeeId!,
        brandId: s.brandId!,
        processId: s.processId!,
      });
      setToast(
        `Assigned ${s.employeeName} as backup. Remaining hard conflicts: ${res.hardConflicts}.`
      );
      router.refresh();
    });
  };

  const handleSimulateChange = (e: React.FormEvent) => {
    e.preventDefault();
    const dateKeys = calendar
      .filter((d) => d.dateKey >= simStartDate && d.dateKey <= simEndDate)
      .map((d) => d.dateKey);
    if (dateKeys.length === 0) return;

    startTransition(async () => {
      const res = await simulateUnavailabilityAction({
        rosterId: roster.id,
        employeeId: simEmployeeId,
        dateKeys,
        newStatus: simStatus,
        reason: simReason,
        autoAssignBackup: simAutoBackup,
      });
      setSimOutput(res);
      setToast(
        `Simulated change: ${res.preservedEntriesCount} cells untouched, ${res.modifiedEntriesCount} updated.`
      );
      router.refresh();
    });
  };

  const filteredEmployees = employees.filter((e) => {
    const matchPod = podFilter === "ALL" || e.podId === podFilter;
    const matchSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.primaryBrandCodes.some((c) =>
        c.toLowerCase().includes(search.toLowerCase())
      );
    return matchPod && matchSearch;
  });

  const filteredConflicts = conflicts.filter((c) => {
    if (conflictFilter === "ALL") return true;
    return c.severity === conflictFilter;
  });

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {formatMonthYear(roster.month, roster.year)} — Interactive Roster
            </h1>
            <span
              className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                roster.status === "PUBLISHED"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              {roster.status}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Click any schedule cell to manually edit status or brand allocations with real-time constraint validation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <RosterSwitcher rosters={allRosters} activeRosterId={roster.id} />
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                const res = await revalidateRosterAction(roster.id);
                setToast(
                  `Re-validated roster: ${res.hardConflicts} hard, ${res.softConflicts} soft conflicts.`
                );
                router.refresh();
              })
            }
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Re-validate
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <a href={`/api/roster/export?rosterId=${roster.id}&format=csv`}>
              <Download className="h-3.5 w-3.5" />
              CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <a href={`/api/roster/export?rosterId=${roster.id}&format=xlsx`}>
              <Download className="h-3.5 w-3.5" />
              Excel
            </a>
          </Button>
          {roster.status === "DRAFT" ? (
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={isPending || coverageStats.hardConflicts > 0}
              title={
                coverageStats.hardConflicts > 0
                  ? "Resolve all hard conflicts before publishing"
                  : "Publish roster"
              }
              onClick={() =>
                startTransition(async () => {
                  await togglePublishRosterAction(roster.id, "PUBLISHED");
                  setToast("Roster published.");
                  router.refresh();
                })
              }
            >
              <Lock className="h-3.5 w-3.5" />
              Publish Roster
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await togglePublishRosterAction(roster.id, "DRAFT");
                  setToast("Reverted roster to DRAFT.");
                  router.refresh();
                })
              }
            >
              <Unlock className="h-3.5 w-3.5" />
              Unlock Draft
            </Button>
          )}
        </div>
      </div>

      {/* Live Health Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-3.5 px-4">
            <div className="text-[11px] text-slate-500 font-medium">
              Demand Coverage
            </div>
            <div className="text-lg font-semibold tabular-nums mt-0.5 text-emerald-700">
              {coverageStats.coveredDemandSlots}/{coverageStats.totalDemandSlots}{" "}
              ({coverageStats.coveragePercent}%)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3.5 px-4">
            <div className="text-[11px] text-slate-500 font-medium">
              Hard Conflicts
            </div>
            <div
              className={`text-lg font-semibold tabular-nums mt-0.5 ${
                coverageStats.hardConflicts > 0
                  ? "text-red-600"
                  : "text-emerald-700"
              }`}
            >
              {coverageStats.hardConflicts}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3.5 px-4">
            <div className="text-[11px] text-slate-500 font-medium">
              Soft Preferences
            </div>
            <div className="text-lg font-semibold tabular-nums mt-0.5 text-amber-700">
              {coverageStats.softConflicts}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3.5 px-4 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-500 font-medium">
                Publish Readiness
              </div>
              <div className="text-xs font-medium mt-1">
                {coverageStats.hardConflicts === 0 ? (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Ready to Publish
                  </span>
                ) : (
                  <span className="text-red-600 flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" /> Resolve Gaps First
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {toast && (
        <div className="rounded-md bg-slate-900 text-white px-4 py-2.5 text-xs flex items-center justify-between">
          <span>{toast}</span>
          <button
            type="button"
            className="text-slate-400 hover:text-white ml-4"
            onClick={() => setToast(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Split Grid + Right Validation & Change Panel */}
      <div className="grid grid-cols-1 2xl:grid-cols-12 gap-5 items-start">
        {/* Matrix Grid */}
        <Card className="2xl:col-span-8 overflow-hidden">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter employee or brand code..."
                className="w-56 h-8 text-xs"
              />
              <Select value={podFilter} onValueChange={setPodFilter}>
                <SelectTrigger className="w-52 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Pods ({employees.length})</SelectItem>
                  {pods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1">
                <EntryStatusPill status="WORKING" compact /> Work
              </span>
              <span className="inline-flex items-center gap-1">
                <EntryStatusPill status="WEEKLY_OFF" compact /> Off
              </span>
              <span className="inline-flex items-center gap-1">
                <EntryStatusPill status="PUBLIC_HOLIDAY" compact /> Hol
              </span>
              <span className="inline-flex items-center gap-1">
                <EntryStatusPill status="PLANNED_LEAVE" compact /> Leave
              </span>
              <span className="inline-flex items-center gap-1">
                <EntryStatusPill status="COMP_OFF" compact /> Comp
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto border-t">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="sticky left-0 z-20 bg-slate-50 text-left px-3 py-2 font-semibold text-slate-700 min-w-[190px] border-r">
                      Employee
                    </th>
                    {calendar.map((day) => (
                      <th
                        key={day.dateKey}
                        className={`px-1 py-1.5 text-center font-medium min-w-[38px] border-r ${
                          day.globalHolidayName
                            ? "bg-violet-50 text-violet-800"
                            : day.dayOfWeek === 0
                              ? "bg-slate-100 text-slate-700"
                              : "text-slate-600"
                        }`}
                        title={day.globalHolidayName ?? day.dateKey}
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
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="border-b hover:bg-slate-50/60">
                      <td className="sticky left-0 z-10 bg-white px-3 py-1.5 border-r">
                        <div className="font-medium text-slate-900 truncate max-w-[170px]">
                          {emp.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">
                          {emp.primaryBrandCodes.length > 0
                            ? emp.primaryBrandCodes.join(", ")
                            : emp.role === "BACKUP_FLOAT"
                              ? "BACKUP FLOAT"
                              : "UNASSIGNED"}
                        </div>
                      </td>
                      {calendar.map((day) => {
                        const entry = entryLookup.get(`${emp.id}::${day.dateKey}`);
                        const cellConflicts =
                          cellConflictMap.get(`${emp.id}::${day.dateKey}`) ?? [];
                        const hasHard = cellConflicts.some(
                          (c) => c.severity === "HARD"
                        );
                        if (!entry) {
                          return (
                            <td
                              key={day.dateKey}
                              className="p-1 text-center border-r text-slate-300"
                            >
                              —
                            </td>
                          );
                        }
                        const hasBackup = entry.allocations.some(
                          (a) => a.isBackup
                        );
                        return (
                          <td
                            key={day.dateKey}
                            className="p-0.5 text-center border-r"
                          >
                            <button
                              type="button"
                              onClick={() => openCellEditor(entry, emp)}
                              title={`${emp.name} • ${day.dateKey} • ${entry.status}${
                                entry.allocations.length
                                  ? " (" +
                                    entry.allocations
                                      .map((a) => `${a.brandCode}:${a.processCode}`)
                                      .join(", ") +
                                    ")"
                                  : ""
                              }`}
                              className="relative inline-flex items-center justify-center rounded hover:opacity-80 transition-opacity"
                            >
                              <EntryStatusPill
                                status={entry.status}
                                compact
                                hasConflict={hasHard}
                              />
                              {hasBackup && (
                                <span
                                  className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-cyan-500 ring-1 ring-white"
                                  title="Backup float active"
                                />
                              )}
                              {entry.isManualOverride && (
                                <span
                                  className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-slate-900"
                                  title="Manually edited"
                                />
                              )}
                            </button>
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

        {/* Right Side Panel: Conflicts + Change Simulator + Audit Log */}
        <Card className="2xl:col-span-4">
          <Tabs defaultValue="conflicts">
            <CardHeader className="pb-2">
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="conflicts" className="text-xs">
                  Conflicts ({conflicts.length})
                </TabsTrigger>
                <TabsTrigger value="simulate" className="text-xs">
                  Handle Change
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs">
                  Audit ({changeLogs.length})
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="pt-2">
              {/* TAB 1: CONFLICTS */}
              <TabsContent value="conflicts" className="space-y-3 mt-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-600">
                    Filter Severity
                  </span>
                  <Select
                    value={conflictFilter}
                    onValueChange={setConflictFilter}
                  >
                    <SelectTrigger className="w-36 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All ({conflicts.length})</SelectItem>
                      <SelectItem value="HARD">
                        Hard ({coverageStats.hardConflicts})
                      </SelectItem>
                      <SelectItem value="SOFT">
                        Soft ({coverageStats.softConflicts})
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                  {filteredConflicts.length === 0 ? (
                    <div className="rounded-md bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      No conflicts matching the active filter.
                    </div>
                  ) : (
                    filteredConflicts.map((c) => (
                      <div
                        key={c.id}
                        className={`rounded-md border p-3 text-xs space-y-2 ${
                          c.severity === "HARD"
                            ? "bg-red-50/50 border-red-200"
                            : "bg-amber-50/50 border-amber-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <SeverityBadge severity={c.severity} />
                          <span className="font-mono text-[11px] text-slate-500">
                            {c.dateKey} • {c.conflictType}
                          </span>
                        </div>
                        <p className="text-slate-800 leading-relaxed">
                          {c.description}
                        </p>
                        {c.suggestions.length > 0 && (
                          <div className="space-y-1.5 pt-1 border-t border-slate-200/70">
                            <div className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-blue-600" />
                              Recommended Backups:
                            </div>
                            {c.suggestions.map((s, idx) => (
                              <div
                                key={`${c.id}-sug-${idx}`}
                                className="flex items-center justify-between gap-2 bg-white rounded border px-2 py-1.5"
                              >
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-800 truncate">
                                    {s.employeeName}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {s.reason}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[11px] shrink-0"
                                  disabled={isPending}
                                  onClick={() => handleAcceptBackup(s, c.dateKey)}
                                >
                                  Assign
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* TAB 2: POST-GENERATION CHANGE SIMULATOR */}
              <TabsContent value="simulate" className="space-y-4 mt-0">
                <div className="rounded-md bg-slate-50 border p-3 text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <UserX className="h-3.5 w-3.5 text-orange-600" />
                    Post-Generation Change Handler
                  </div>
                  <p>
                    Simulate a mid-month leave or sudden unavailability. Only affected days and brands are re-evaluated; the rest of the roster remains untouched.
                  </p>
                </div>

                <form onSubmit={handleSimulateChange} className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Employee</Label>
                    <Select
                      value={simEmployeeId}
                      onValueChange={setSimEmployeeId}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.name} (
                            {e.primaryBrandCodes.join(", ") || e.role})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">From Date</Label>
                      <Input
                        type="date"
                        value={simStartDate}
                        onChange={(e) => setSimStartDate(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">To Date</Label>
                      <Input
                        type="date"
                        value={simEndDate}
                        onChange={(e) => setSimEndDate(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Status</Label>
                      <Select
                        value={simStatus}
                        onValueChange={(v) =>
                          setSimStatus(v as Exclude<EntryStatus, "WORKING">)
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PLANNED_LEAVE">
                            Planned Leave
                          </SelectItem>
                          <SelectItem value="COMP_OFF">Comp-Off</SelectItem>
                          <SelectItem value="UNAVAILABLE">
                            Unavailable
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Reason</Label>
                      <Input
                        value={simReason}
                        onChange={(e) => setSimReason(e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
                    <input
                      type="checkbox"
                      checked={simAutoBackup}
                      onChange={(e) => setSimAutoBackup(e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Auto-assign best eligible backup float if coverage drops
                  </label>

                  <Button
                    type="submit"
                    size="sm"
                    className="w-full"
                    disabled={isPending}
                  >
                    {isPending
                      ? "Evaluating Impact..."
                      : "Apply Change & Evaluate Coverage"}
                  </Button>
                </form>

                {simOutput && (
                  <div className="rounded-md border bg-slate-50 p-3 text-xs space-y-2">
                    <div className="font-semibold text-slate-900">
                      Impact Summary
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        Preserved cells:{" "}
                        <span className="font-mono font-semibold">
                          {simOutput.preservedEntriesCount}
                        </span>
                      </div>
                      <div>
                        Modified cells:{" "}
                        <span className="font-mono font-semibold">
                          {simOutput.modifiedEntriesCount}
                        </span>
                      </div>
                      <div>
                        Hard conflicts before:{" "}
                        <span className="font-mono font-semibold">
                          {simOutput.hardConflictsBefore}
                        </span>
                      </div>
                      <div>
                        Hard conflicts after:{" "}
                        <span className="font-mono font-semibold text-red-600">
                          {simOutput.hardConflictsAfter}
                        </span>
                      </div>
                    </div>
                    {simOutput.affectedSlots.map((slot, i) => (
                      <div
                        key={i}
                        className="bg-white rounded border p-2 space-y-1"
                      >
                        <div className="font-medium text-slate-800">
                          {slot.dateKey} • {slot.brandName} ({slot.processCode})
                        </div>
                        <div className="text-slate-600">
                          Coverage: {slot.remainingWorkers}/{slot.requiredStaff}
                          {slot.backupAssigned && (
                            <span className="ml-1.5 text-emerald-700 font-medium">
                              (Backup: {slot.backupAssigned})
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* TAB 3: AUDIT LOG */}
              <TabsContent value="history" className="space-y-2 mt-0 max-h-[560px] overflow-y-auto">
                {changeLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded border bg-slate-50/70 p-2.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                        {log.actionType}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {log.createdAt.slice(0, 16).replace("T", " ")}
                      </span>
                    </div>
                    <p className="text-slate-700">{log.summary}</p>
                  </div>
                ))}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>

      {/* Cell Edit Dialog */}
      <Dialog
        open={Boolean(selectedCell)}
        onOpenChange={(open) => !open && setSelectedCell(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Edit Schedule — {selectedCell?.employee.name} (
              {selectedCell?.entry.dateKey})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Day Status</Label>
                <Select
                  value={editStatus}
                  onValueChange={(v) => setEditStatus(v as EntryStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WORKING">Working</SelectItem>
                    <SelectItem value="WEEKLY_OFF">Weekly Off</SelectItem>
                    <SelectItem value="PUBLIC_HOLIDAY">Public Holiday</SelectItem>
                    <SelectItem value="PLANNED_LEAVE">Planned Leave</SelectItem>
                    <SelectItem value="COMP_OFF">Comp-Off</SelectItem>
                    <SelectItem value="UNAVAILABLE">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Shift Window</Label>
                <Select
                  value={editShift}
                  onValueChange={(v) => setEditShift(v as ShiftWindow)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">STANDARD</SelectItem>
                    <SelectItem value="MORNING">MORNING</SelectItem>
                    <SelectItem value="EVENING">EVENING</SelectItem>
                    <SelectItem value="NIGHT">NIGHT</SelectItem>
                    <SelectItem value="FLEXIBLE">FLEXIBLE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {editStatus === "WORKING" && (
              <div className="space-y-1.5">
                <Label>Brand & Process Allocations Covered Today</Label>
                <div className="max-h-48 overflow-y-auto rounded border p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-slate-50">
                  {brandProcessOptions.map((opt) => {
                    const key = `${opt.brandId}::${opt.processId}`;
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-white cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedSlots.has(key)}
                          onChange={() => toggleSlot(key)}
                        />
                        <span className="font-mono text-[11px] font-semibold text-blue-700">
                          {opt.brandCode}
                        </span>
                        <span className="text-slate-700 truncate">
                          {opt.processCode}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Override Reason</Label>
              <Input
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Reason for manual adjustment"
              />
            </div>

            <div className="rounded bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-800 flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Saving runs live conflict validation across all brands, shifts, and approved leaves immediately.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedCell(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCell} disabled={isPending}>
              {isPending ? "Validating..." : "Save & Validate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
