"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Users, Search } from "lucide-react";
import {
  createEmployeeAction,
  deleteEmployeeAction,
  updateEmployeeAction,
} from "@/app/actions/manage";
import { RoleBadge } from "@/components/status-badge";
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
import { DAY_NAMES } from "@/lib/utils";

export interface EmployeeRow {
  id: string;
  name: string;
  email: string | null;
  role: string;
  podId: string;
  podName: string;
  maxWeeklyWorkdays: number;
  preferredOffDay: number | null;
  shiftWindow: string;
  active: boolean;
  brandCount: number;
}

export interface PodOption {
  id: string;
  name: string;
}

export function EmployeesManager({
  employees,
  pods,
}: {
  employees: EmployeeRow[];
  pods: PodOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [podFilter, setPodFilter] = useState("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("AGENT");
  const [podId, setPodId] = useState(pods[0]?.id ?? "");
  const [maxWeeklyWorkdays, setMaxWeeklyWorkdays] = useState("6");
  const [preferredOffDay, setPreferredOffDay] = useState<string>("0");
  const [shiftWindow, setShiftWindow] = useState("STANDARD");
  const [active, setActive] = useState(true);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setEmail("");
    setRole("AGENT");
    setPodId(pods[0]?.id ?? "");
    setMaxWeeklyWorkdays("6");
    setPreferredOffDay("0");
    setShiftWindow("STANDARD");
    setActive(true);
    setError(null);
    setOpen(true);
  };

  const openEdit = (emp: EmployeeRow) => {
    setEditing(emp);
    setName(emp.name);
    setEmail(emp.email ?? "");
    setRole(emp.role);
    setPodId(emp.podId);
    setMaxWeeklyWorkdays(String(emp.maxWeeklyWorkdays));
    setPreferredOffDay(
      emp.preferredOffDay === null ? "NONE" : String(emp.preferredOffDay)
    );
    setShiftWindow(emp.shiftWindow);
    setActive(emp.active);
    setError(null);
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          name,
          email,
          role,
          podId,
          maxWeeklyWorkdays: Number(maxWeeklyWorkdays),
          preferredOffDay:
            preferredOffDay === "NONE" ? null : Number(preferredOffDay),
          shiftWindow,
          active,
        };
        if (editing) {
          await updateEmployeeAction(editing.id, payload);
        } else {
          await createEmployeeAction(payload);
        }
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save employee");
      }
    });
  };

  const handleDelete = (emp: EmployeeRow) => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteEmployeeAction(emp.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete employee");
      }
    });
  };

  const filtered = employees.filter((e) => {
    const matchesSearch =
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      (e.email ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesPod = podFilter === "ALL" || e.podId === podFilter;
    return matchesSearch && matchesPod;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Team & Employees
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage CX agents, Pod Leads, and backup floats with individual weekly-off preferences and shift windows.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Employee
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
            <Users className="h-4 w-4 text-slate-500" />
            Roster Directory ({filtered.length} of {employees.length})
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name or email..."
                className="pl-8 h-8 text-xs"
              />
            </div>
            <Select value={podFilter} onValueChange={setPodFilter}>
              <SelectTrigger className="w-52 h-8 text-xs">
                <SelectValue placeholder="Filter by pod" />
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Pod</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Max Days/Wk</TableHead>
                <TableHead>Preferred Off</TableHead>
                <TableHead>Brands</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((emp) => (
                <TableRow key={emp.id} className={!emp.active ? "opacity-50" : undefined}>
                  <TableCell>
                    <div className="font-medium text-slate-900">{emp.name}</div>
                    {emp.email && (
                      <div className="text-xs text-slate-400">{emp.email}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={emp.role} />
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {emp.podName}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">
                    {emp.shiftWindow}
                  </TableCell>
                  <TableCell className="tabular-nums font-mono text-xs">
                    {emp.maxWeeklyWorkdays}d
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {emp.preferredOffDay !== null
                      ? DAY_NAMES[emp.preferredOffDay]
                      : "Flexible"}
                  </TableCell>
                  <TableCell className="tabular-nums font-mono text-xs">
                    {emp.brandCount}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(emp)}
                      disabled={isPending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(emp)}
                      disabled={isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
            <DialogTitle>
              {editing ? "Edit Employee" : "Add New Employee"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="emp-name">Full Name</Label>
                <Input
                  id="emp-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="emp-email">Email</Label>
                <Input
                  id="emp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Operational Pod</Label>
                <Select value={podId} onValueChange={setPodId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pods.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AGENT">Agent</SelectItem>
                    <SelectItem value="POD_LEAD">Pod Lead</SelectItem>
                    <SelectItem value="BACKUP_FLOAT">Backup Float</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                    <SelectItem value="FLEXIBLE">FLEXIBLE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Max Days/Week</Label>
                <Select
                  value={maxWeeklyWorkdays}
                  onValueChange={setMaxWeeklyWorkdays}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 6, 7].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Preferred Off Day</Label>
                <Select
                  value={preferredOffDay}
                  onValueChange={setPreferredOffDay}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">No Preference</SelectItem>
                    {DAY_NAMES.map((d, idx) => (
                      <SelectItem key={d} value={String(idx)}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Employee"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
