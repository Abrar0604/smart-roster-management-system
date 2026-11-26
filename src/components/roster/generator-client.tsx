"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CalendarCog,
  Play,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { generateRosterAction } from "@/app/actions/roster";
import { formatMonthYear, MONTH_NAMES } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ExistingRosterSummary {
  id: string;
  month: number;
  year: number;
  status: string;
  generatedAt: string;
  entryCount: number;
  hardConflicts: number;
  softConflicts: number;
}

export function GeneratorClient({
  rosters,
  counts,
}: {
  rosters: ExistingRosterSummary[];
  counts: {
    activeEmployees: number;
    brands: number;
    pods: number;
    configs: number;
  };
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [month, setMonth] = useState("12");
  const [year, setYear] = useState("2026");
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    rosterId: string;
    month: number;
    year: number;
    stats: {
      totalDemandSlots: number;
      coveredDemandSlots: number;
      coveragePercent: number;
      hardConflicts: number;
      softConflicts: number;
      backupActivations: number;
    };
  } | null>(null);

  const handleGenerate = () => {
    setError(null);
    const m = Number(month);
    const y = Number(year);
    startTransition(async () => {
      try {
        const res = await generateRosterAction(m, y);
        setLastResult({
          rosterId: res.rosterId,
          month: m,
          year: y,
          stats: res.stats,
        });
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to generate roster"
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Monthly Roster Generator
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Run the deterministic constraint solver across all pods, brand operating calendars, approved leaves, and weekly-off rules.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-slate-500">Active Employees</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">
              {counts.activeEmployees}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-slate-500">Operational Pods</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">
              {counts.pods}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-slate-500">D2C Brands</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">
              {counts.brands}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-slate-500">Process Rules</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">
              {counts.configs}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCog className="h-4 w-4 text-blue-600" />
            Generate or Regenerate Target Month
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Month</label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, idx) => (
                    <SelectItem key={name} value={String(idx + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600">Year</label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2025, 2026, 2027, 2028].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={isPending}
              className="gap-2"
            >
              <Play className="h-4 w-4" />
              {isPending
                ? "Solving Constraints..."
                : `Generate ${formatMonthYear(Number(month), Number(year))}`}
            </Button>
          </div>

          <p className="text-xs text-slate-500">
            Note: Re-generating a month overwrites the previous schedule for that month using current assignments, operating calendars, holidays, and approved leaves. Use the Interactive Editor for targeted post-generation updates.
          </p>

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {lastResult && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-blue-700" />
                  <span className="font-semibold text-slate-900">
                    {formatMonthYear(lastResult.month, lastResult.year)} Roster Generated
                  </span>
                </div>
                <Button asChild size="sm" className="gap-1.5">
                  <Link href={`/roster/${lastResult.rosterId}`}>
                    Open Interactive Editor
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white rounded border px-3 py-2">
                  <div className="text-slate-500">Demand Coverage</div>
                  <div className="text-base font-semibold tabular-nums text-emerald-700">
                    {lastResult.stats.coveredDemandSlots}/
                    {lastResult.stats.totalDemandSlots} (
                    {lastResult.stats.coveragePercent}%)
                  </div>
                </div>
                <div className="bg-white rounded border px-3 py-2">
                  <div className="text-slate-500">Hard Conflicts</div>
                  <div className="text-base font-semibold tabular-nums text-red-600">
                    {lastResult.stats.hardConflicts}
                  </div>
                </div>
                <div className="bg-white rounded border px-3 py-2">
                  <div className="text-slate-500">Soft Preferences</div>
                  <div className="text-base font-semibold tabular-nums text-amber-700">
                    {lastResult.stats.softConflicts}
                  </div>
                </div>
                <div className="bg-white rounded border px-3 py-2">
                  <div className="text-slate-500">Backup Activations</div>
                  <div className="text-base font-semibold tabular-nums text-cyan-700">
                    {lastResult.stats.backupActivations}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Generated Monthly Rosters</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entries</TableHead>
                <TableHead>Hard Conflicts</TableHead>
                <TableHead>Soft Warnings</TableHead>
                <TableHead>Generated At</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rosters.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium text-slate-900">
                    {formatMonthYear(r.month, r.year)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        r.status === "PUBLISHED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums font-mono text-xs">
                    {r.entryCount}
                  </TableCell>
                  <TableCell>
                    {r.hardConflicts > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {r.hardConflicts}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <ShieldCheck className="h-3.5 w-3.5" />0
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums font-mono text-xs text-amber-700">
                    {r.softConflicts}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 font-mono">
                    {r.generatedAt.slice(0, 16).replace("T", " ")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                      <Link href={`/roster/${r.id}`}>Open Editor</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
