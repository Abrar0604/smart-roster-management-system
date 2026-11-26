"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Link2, Search } from "lucide-react";
import {
  deleteAssignmentAction,
  upsertAssignmentAction,
} from "@/app/actions/manage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface AssignmentRow {
  id: string;
  employeeId: string;
  employeeName: string;
  podName: string;
  brandId: string;
  brandName: string;
  brandCode: string;
  processId: string;
  processCode: string;
  allocationType: string;
  shiftWindow: string;
  capacityWeight: number;
  priority: number;
}

export function AssignmentsManager({
  assignments,
  employees,
  brands,
  processes,
}: {
  assignments: AssignmentRow[];
  employees: Array<{ id: string; name: string; podName: string }>;
  brands: Array<{ id: string; name: string; code: string }>;
  processes: Array<{ id: string; code: string; name: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [brandId, setBrandId] = useState(brands[0]?.id ?? "");
  const [processId, setProcessId] = useState(processes[0]?.id ?? "");
  const [allocationType, setAllocationType] = useState("PRIMARY");
  const [shiftWindow, setShiftWindow] = useState("STANDARD");
  const [capacityWeight, setCapacityWeight] = useState("0.5");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await upsertAssignmentAction({
          employeeId,
          brandId,
          processId,
          allocationType,
          shiftWindow,
          capacityWeight: Number(capacityWeight),
          priority: allocationType === "PRIMARY" ? 1 : 2,
        });
        setOpen(false);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save assignment"
        );
      }
    });
  };

  const filtered = assignments.filter((a) => {
    const matchesSearch =
      a.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      a.brandName.toLowerCase().includes(search.toLowerCase()) ||
      a.processCode.toLowerCase().includes(search.toLowerCase());
    const matchesType =
      typeFilter === "ALL" || a.allocationType === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Resource Allocations & Assignments
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Map employees to brands and processes as Primary owners or designated Backup resources.
          </p>
        </div>
        <Button
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
          size="sm"
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Add Assignment
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="h-4 w-4 text-slate-500" />
            Active Assignments ({filtered.length})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employee, brand, process..."
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-40 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="PRIMARY">PRIMARY Only</SelectItem>
                <SelectItem value="BACKUP">BACKUP Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Pod</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Process</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>FTE Weight</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium text-slate-900">
                    {a.employeeName}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {a.podName}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium text-slate-800">{a.brandName}</span>{" "}
                    <span className="font-mono text-[11px] text-slate-400">
                      ({a.brandCode})
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-blue-700">
                    {a.processCode}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${
                        a.allocationType === "PRIMARY"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-cyan-50 text-cyan-800 border-cyan-200"
                      }`}
                    >
                      {a.allocationType}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">
                    {a.shiftWindow}
                  </TableCell>
                  <TableCell className="font-mono text-xs tabular-nums">
                    {a.capacityWeight.toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        startTransition(async () => {
                          await deleteAssignmentAction(a.id);
                        })
                      }
                      disabled={isPending}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create / Update Resource Assignment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} ({e.podName})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Select value={brandId} onValueChange={setBrandId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Process</Label>
                <Select value={processId} onValueChange={setProcessId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {processes.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Allocation Type</Label>
                <Select value={allocationType} onValueChange={setAllocationType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRIMARY">PRIMARY</SelectItem>
                    <SelectItem value="BACKUP">BACKUP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Shift Window</Label>
                <Select value={shiftWindow} onValueChange={setShiftWindow}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STANDARD">STANDARD</SelectItem>
                    <SelectItem value="MORNING">MORNING</SelectItem>
                    <SelectItem value="EVENING">EVENING</SelectItem>
                    <SelectItem value="NIGHT">NIGHT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>FTE Weight</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="2.0"
                  value={capacityWeight}
                  onChange={(e) => setCapacityWeight(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Assignment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
