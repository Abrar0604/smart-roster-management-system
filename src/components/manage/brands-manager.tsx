"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Store, Settings2 } from "lucide-react";
import {
  createBrandAction,
  deleteBrandAction,
  deleteBrandProcessConfigAction,
  updateBrandAction,
  upsertBrandProcessConfigAction,
} from "@/app/actions/manage";
import { DAY_SHORT_NAMES, getOperatingRuleLabel } from "@/lib/utils";
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

function formatDayOverrides(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      operatingDays?: number[];
      dayMinStaff?: Record<string, number>;
    };
    const parts: string[] = [];
    if (parsed.dayMinStaff) {
      const rules = Object.entries(parsed.dayMinStaff)
        .map(([dow, count]) => `${DAY_SHORT_NAMES[Number(dow)] ?? dow}: min ${count}`)
        .join(", ");
      if (rules) parts.push(rules);
    }
    if (parsed.operatingDays) {
      const days = parsed.operatingDays
        .map((d) => DAY_SHORT_NAMES[d] ?? String(d))
        .join("/");
      if (days) parts.push(`Days: ${days}`);
    }
    return parts.length > 0 ? parts.join(" • ") : raw;
  } catch {
    return raw;
  }
}

export interface BrandConfigRow {
  id: string;
  processId: string;
  processCode: string;
  processName: string;
  operatingRule: string;
  shiftWindow: string;
  minStaff: number;
  dayOverrides: string | null;
}

export interface BrandRow {
  id: string;
  name: string;
  code: string;
  category: string | null;
  description: string | null;
  active: boolean;
  primaryEmployeeCount: number;
  configs: BrandConfigRow[];
}

export interface ProcessOption {
  id: string;
  code: string;
  name: string;
}

export function BrandsManager({
  brands,
  processes,
}: {
  brands: BrandRow[];
  processes: ProcessOption[];
}) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Brand Create/Edit Dialog
  const [brandOpen, setBrandOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<BrandRow | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");

  // Process Config Dialog
  const [cfgOpen, setCfgOpen] = useState(false);
  const [cfgBrand, setCfgBrand] = useState<BrandRow | null>(null);
  const [cfgProcessId, setCfgProcessId] = useState(processes[0]?.id ?? "");
  const [cfgRule, setCfgRule] = useState("NO_SUNDAYS_NO_HOLIDAYS");
  const [cfgShift, setCfgShift] = useState("STANDARD");
  const [cfgMinStaff, setCfgMinStaff] = useState("1");
  const [cfgOverrides, setCfgOverrides] = useState("");

  const singleCount = brands.filter((b) => b.primaryEmployeeCount <= 1).length;
  const multiCount = brands.filter((b) => b.primaryEmployeeCount > 1).length;

  const openCreateBrand = () => {
    setEditingBrand(null);
    setName("");
    setCode("");
    setCategory("");
    setDescription("");
    setError(null);
    setBrandOpen(true);
  };

  const openEditBrand = (b: BrandRow) => {
    setEditingBrand(b);
    setName(b.name);
    setCode(b.code);
    setCategory(b.category ?? "");
    setDescription(b.description ?? "");
    setError(null);
    setBrandOpen(true);
  };

  const openConfigDialog = (b: BrandRow, existing?: BrandConfigRow) => {
    setCfgBrand(b);
    setCfgProcessId(existing?.processId ?? processes[0]?.id ?? "");
    setCfgRule(existing?.operatingRule ?? "NO_SUNDAYS_NO_HOLIDAYS");
    setCfgShift(existing?.shiftWindow ?? "STANDARD");
    setCfgMinStaff(String(existing?.minStaff ?? 1));
    setCfgOverrides(existing?.dayOverrides ?? "");
    setError(null);
    setCfgOpen(true);
  };

  const handleSaveBrand = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const payload = {
          name,
          code,
          category: category || null,
          description: description || null,
          active: true,
        };
        if (editingBrand) {
          await updateBrandAction(editingBrand.id, payload);
        } else {
          await createBrandAction(payload);
        }
        setBrandOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save brand");
      }
    });
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cfgBrand) return;
    setError(null);
    startTransition(async () => {
      try {
        await upsertBrandProcessConfigAction({
          brandId: cfgBrand.id,
          processId: cfgProcessId,
          operatingRule: cfgRule,
          shiftWindow: cfgShift,
          minStaff: Number(cfgMinStaff),
          dayOverrides: cfgOverrides.trim() || null,
          active: true,
        });
        setCfgOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save rule");
      }
    });
  };

  const filtered = brands.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            D2C Brands & Client Working Rules
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure brand-level & process-level operating calendars independently from employee schedules.
          </p>
        </div>
        <Button onClick={openCreateBrand} size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          Add Brand
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-slate-500 font-medium">Total Brands</div>
            <div className="text-2xl font-semibold tabular-nums mt-1">
              {brands.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-slate-500 font-medium">
              Single-Resource Brands
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-1 text-amber-700">
              {singleCount} ({brands.length ? Math.round((singleCount / brands.length) * 100) : 0}%)
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs text-slate-500 font-medium">
              Multi-Resource Brands
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-1 text-emerald-700">
              {multiCount} ({brands.length ? Math.round((multiCount / brands.length) * 100) : 0}%)
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brands by name or code..."
          className="max-w-xs h-9 bg-white"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((brand) => (
          <Card key={brand.id}>
            <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-slate-400" />
                  <CardTitle className="text-base">{brand.name}</CardTitle>
                  <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                    {brand.code}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded border ${
                      brand.primaryEmployeeCount > 1
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}
                  >
                    {brand.primaryEmployeeCount > 1
                      ? `Multi-Resource (${brand.primaryEmployeeCount} staff)`
                      : `Single-Resource (${brand.primaryEmployeeCount} staff)`}
                  </span>
                  {brand.category && (
                    <span className="text-xs text-slate-500">{brand.category}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => openConfigDialog(brand)}
                >
                  <Settings2 className="h-3.5 w-3.5" />
                  Add Rule
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => openEditBrand(brand)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-600 hover:bg-red-50"
                  onClick={() =>
                    startTransition(async () => {
                      await deleteBrandAction(brand.id);
                    })
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {brand.configs.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No process rules configured yet.
                </p>
              ) : (
                brand.configs.map((cfg) => (
                  <div
                    key={cfg.id}
                    className="flex items-center justify-between gap-2 rounded-md border bg-slate-50/70 px-3 py-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-blue-700">
                          {cfg.processCode}
                        </span>
                        <span className="text-slate-700 font-medium">
                          {getOperatingRuleLabel(cfg.operatingRule)}
                        </span>
                      </div>
                      <div className="text-slate-500">
                        Min staff: <span className="font-mono">{cfg.minStaff}</span> •
                        Shift: <span className="font-mono">{cfg.shiftWindow}</span>
                        {cfg.dayOverrides && (
                          <span className="ml-1.5 text-indigo-600">
                            • {formatDayOverrides(cfg.dayOverrides)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => openConfigDialog(brand, cfg)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-red-600"
                        onClick={() =>
                          startTransition(async () => {
                            await deleteBrandProcessConfigAction(cfg.id);
                          })
                        }
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Brand Modal */}
      <Dialog open={brandOpen} onOpenChange={setBrandOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBrand ? "Edit Brand" : "Add D2C Brand"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveBrand} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Brand Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ember Apparel"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Code (Short ID)</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. EMBR"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Skincare, Electronics"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setBrandOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Brand"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Process Working Rule Modal */}
      <Dialog open={cfgOpen} onOpenChange={setCfgOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Working Rule — {cfgBrand?.name}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Process</Label>
              <Select value={cfgProcessId} onValueChange={setCfgProcessId}>
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
            <div className="space-y-1.5">
              <Label>Operating Calendar Rule</Label>
              <Select value={cfgRule} onValueChange={setCfgRule}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EVERY_DAY">
                    365 Days (Includes Sundays & Holidays)
                  </SelectItem>
                  <SelectItem value="DAILY_NO_HOLIDAYS">
                    Daily Except Public Holidays
                  </SelectItem>
                  <SelectItem value="NO_SUNDAYS_NO_HOLIDAYS">
                    Sundays & Public Holidays Off
                  </SelectItem>
                  <SelectItem value="CUSTOM">
                    Custom (Use Day Overrides JSON)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Minimum Daily Staff</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={cfgMinStaff}
                  onChange={(e) => setCfgMinStaff(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Required Shift Window</Label>
                <Select value={cfgShift} onValueChange={setCfgShift}>
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
            </div>
            <div className="space-y-1.5">
              <Label>Day-Specific Overrides (Optional JSON)</Label>
              <Input
                value={cfgOverrides}
                onChange={(e) => setCfgOverrides(e.target.value)}
                placeholder='e.g. {"dayMinStaff":{"6":2}}'
                className="font-mono text-xs"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCfgOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Rule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
