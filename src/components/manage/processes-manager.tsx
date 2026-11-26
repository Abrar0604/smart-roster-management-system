"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Workflow } from "lucide-react";
import {
  createProcessAction,
  deleteProcessAction,
  updateProcessAction,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

export interface ProcessItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  brandCount: number;
  assignmentCount: number;
}

export function ProcessesManager({ processes }: { processes: ProcessItem[] }) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProcessItem | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setCode("");
    setName("");
    setDescription("");
    setError(null);
    setOpen(true);
  };

  const openEdit = (proc: ProcessItem) => {
    setEditing(proc);
    setCode(proc.code);
    setName(proc.name);
    setDescription(proc.description ?? "");
    setError(null);
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const payload = { code, name, description: description || null };
        if (editing) {
          await updateProcessAction(editing.id, payload);
        } else {
          await createProcessAction(payload);
        }
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save process");
      }
    });
  };

  const handleDelete = (proc: ProcessItem) => {
    setError(null);
    startTransition(async () => {
      try {
        await deleteProcessAction(proc.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete process");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Operational Processes
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Define CS, ACC, NDR, Retention, and any custom D2C operational queues.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Process
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
            <Workflow className="h-4 w-4 text-slate-500" />
            Active Processes ({processes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Process Name</TableHead>
                <TableHead>Brands Using</TableHead>
                <TableHead>Staff Allocations</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processes.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs font-semibold text-blue-700">
                    {p.code}
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">
                    {p.name}
                  </TableCell>
                  <TableCell className="tabular-nums font-mono text-xs">
                    {p.brandCount}
                  </TableCell>
                  <TableCell className="tabular-nums font-mono text-xs">
                    {p.assignmentCount}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500 max-w-md truncate">
                    {p.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(p)}
                      disabled={isPending}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(p)}
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
            <DialogTitle>{editing ? "Edit Process" : "Create Process"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="proc-code">Process Code</Label>
              <Input
                id="proc-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. VIP_CARE"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proc-name">Process Name</Label>
              <Input
                id="proc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. VIP Concierge Support"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="proc-desc">Description</Label>
              <Textarea
                id="proc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Process"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
