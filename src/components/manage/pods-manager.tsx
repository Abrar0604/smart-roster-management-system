"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Network } from "lucide-react";
import {
  createPodAction,
  deletePodAction,
  updatePodAction,
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
import { Textarea } from "@/components/ui/textarea";

export interface PodItem {
  id: string;
  name: string;
  description: string | null;
  leadId: string | null;
  leadName: string | null;
  employeeCount: number;
}

export interface LeadOption {
  id: string;
  name: string;
  role: string;
}

export function PodsManager({
  pods,
  employees,
}: {
  pods: PodItem[];
  employees: LeadOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PodItem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leadId, setLeadId] = useState<string>("NONE");
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setLeadId("NONE");
    setError(null);
    setOpen(true);
  };

  const openEdit = (pod: PodItem) => {
    setEditing(pod);
    setName(pod.name);
    setDescription(pod.description ?? "");
    setLeadId(pod.leadId ?? "NONE");
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
          description: description || null,
          leadId: leadId === "NONE" ? null : leadId,
        };
        if (editing) {
          await updatePodAction(editing.id, payload);
        } else {
          await createPodAction(payload);
        }
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save pod");
      }
    });
  };

  const handleDelete = (pod: PodItem) => {
    setError(null);
    startTransition(async () => {
      try {
        await deletePodAction(pod.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete pod");
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Operational Pods
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Group employees into operational pods and designate Pod Leads without touching code.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Pod
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
            <Network className="h-4 w-4 text-slate-500" />
            Configured Pods ({pods.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pod Name</TableHead>
                <TableHead>Pod Lead</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pods.map((pod) => (
                <TableRow key={pod.id}>
                  <TableCell className="font-medium text-slate-900">
                    {pod.name}
                  </TableCell>
                  <TableCell>
                    {pod.leadName ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-medium">
                        {pod.leadName}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums font-mono text-xs">
                    {pod.employeeCount}
                  </TableCell>
                  <TableCell className="text-sm text-slate-500 max-w-md truncate">
                    {pod.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEdit(pod)}
                      disabled={isPending}
                      aria-label={`Edit ${pod.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(pod)}
                      disabled={isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      aria-label={`Delete ${pod.name}`}
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
            <DialogTitle>{editing ? "Edit Operational Pod" : "Create Operational Pod"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pod-name">Pod Name</Label>
              <Input
                id="pod-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Pod Epsilon — Electronics"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pod-lead">Pod Lead</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger id="pod-lead">
                  <SelectValue placeholder="Select Pod Lead" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Unassigned</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pod-desc">Description</Label>
              <Textarea
                id="pod-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Scope of D2C brands handled by this pod"
                rows={2}
              />
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
                {isPending ? "Saving..." : editing ? "Save Changes" : "Create Pod"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
