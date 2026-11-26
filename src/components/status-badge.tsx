import { cn } from "@/lib/utils";

const ENTRY_STYLES: Record<
  string,
  { short: string; label: string; classes: string }
> = {
  WORKING: {
    short: "W",
    label: "Working",
    classes: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  WEEKLY_OFF: {
    short: "WO",
    label: "Weekly Off",
    classes: "bg-blue-50 text-blue-700 border-blue-200",
  },
  PUBLIC_HOLIDAY: {
    short: "PH",
    label: "Public Holiday",
    classes: "bg-violet-50 text-violet-700 border-violet-200",
  },
  PLANNED_LEAVE: {
    short: "PL",
    label: "Planned Leave",
    classes: "bg-orange-50 text-orange-800 border-orange-200",
  },
  COMP_OFF: {
    short: "CO",
    label: "Comp-Off",
    classes: "bg-teal-50 text-teal-800 border-teal-200",
  },
  UNAVAILABLE: {
    short: "UA",
    label: "Unavailable",
    classes: "bg-rose-50 text-rose-800 border-rose-200",
  },
};

export function EntryStatusPill({
  status,
  compact = false,
  hasConflict = false,
}: {
  status: string;
  compact?: boolean;
  hasConflict?: boolean;
}) {
  const style = ENTRY_STYLES[status] ?? {
    short: status.slice(0, 2),
    label: status,
    classes: "bg-slate-100 text-slate-700 border-slate-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded border font-medium leading-none",
        compact ? "px-1.5 py-1 text-[10px] font-mono min-w-[28px]" : "px-2 py-1 text-xs",
        style.classes,
        hasConflict && "ring-2 ring-red-500 ring-offset-1"
      )}
    >
      {compact ? style.short : style.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border",
        severity === "HARD"
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-amber-50 text-amber-800 border-amber-200"
      )}
    >
      {severity === "HARD" ? "Hard Conflict" : "Soft Preference"}
    </span>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    POD_LEAD: "bg-indigo-50 text-indigo-700 border-indigo-200",
    BACKUP_FLOAT: "bg-cyan-50 text-cyan-800 border-cyan-200",
    AGENT: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const labels: Record<string, string> = {
    POD_LEAD: "Pod Lead",
    BACKUP_FLOAT: "Backup Float",
    AGENT: "Agent",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border whitespace-nowrap shrink-0",
        styles[role] ?? styles.AGENT
      )}
    >
      {labels[role] ?? role}
    </span>
  );
}
