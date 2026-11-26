"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { formatMonthYear } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface RosterOption {
  id: string;
  month: number;
  year: number;
  status: string;
}

export function RosterSwitcher({
  rosters,
  activeRosterId,
}: {
  rosters: RosterOption[];
  activeRosterId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (rosters.length === 0) return null;

  const handleChange = (rosterId: string) => {
    if (pathname.startsWith("/roster/") && pathname !== "/roster/generate") {
      router.push(`/roster/${rosterId}`);
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("rosterId", rosterId);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
        Active Roster:
      </span>
      <Select value={activeRosterId ?? undefined} onValueChange={handleChange}>
        <SelectTrigger className="w-[210px] h-8 bg-white text-xs">
          <SelectValue placeholder="Select month" />
        </SelectTrigger>
        <SelectContent>
          {rosters.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {formatMonthYear(r.month, r.year)} ({r.status})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
