"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Check, X, CalendarOff } from "lucide-react";
import {
  createTimeOffRangeAction,
  deleteTimeOffAction,
  updateTimeOffStatusAction,
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

export interface TimeOffRow {
  id: string;
  employeeId: string;
  employeeName: string;
  podName: string;
  dateKey: string;
  type: string;
  status: string;
  reason: string | null;
}

export function TimeOffsManager({
  timeOffs,
  employees,
}: {
  timeOffs: TimeOffRow[];
  employees: Array<{ id: string; name: string; podName: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [startDate, setStartDate] = useState("2026-12-18");
  const [endDate, setEndDate] = useState("2026-12-18");
  const [type, setType] = useState("PLANNED_LEAVE");
  const [status, setStatus] = useState("APPROVED");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createTimeOffRangeAction({
          employeeId,
          startDate,
          endDate,
          type,
          status,
          reason: reason || null,
        });
        setOpen(false);
        setReason("");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to save leave record"
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Leaves, Comp-Offs & Unavailability
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Approved time-off records lock employee unavailability during roster generation and trigger gap detection.
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
          Add Leave / Comp-Off
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-slate-500" />
            Time-Off Ledger ({timeOffs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Pod</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {timeOffs.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs font-medium">
                    {t.dateKey}
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">
                    {t.employeeName}
                  </TableCell>
                  <TableCell className="text-xs text-slate-500">
                    {t.podName}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-50 text-orange-800 border border-orange-200 text-[11px] font-medium">
                      {t.type.replace("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        t.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : t.status === "PENDING"
                            ? "bg-amber-50 text-amber-800 border-amber-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {t.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-500 max-w-xs truncate">
                    {t.reason ?? "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    {t.status !== "APPROVED" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Approve"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await updateTimeOffStatusAction(t.id, "APPROVED");
                          })
                        }
                        className="text-emerald-600 hover:bg-emerald-50"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    {t.status === "PENDING" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Reject"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(async () => {
                            await updateTimeOffStatusAction(t.id, "REJECTED");
                          })
                        }
                        className="text-amber-600 hover:bg-amber-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          await deleteTimeOffAction(t.id);
                        })
                      }
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
            <DialogTitle>Schedule Leave / Comp-Off</DialogTitle>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLANNED_LEAVE">Planned Leave</SelectItem>
                    <SelectItem value="COMP_OFF">Comp-Off</SelectItem>
                    <SelectItem value="UNAVAILABLE">Unavailable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Approval Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason / Note</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Optional note"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Leave"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
