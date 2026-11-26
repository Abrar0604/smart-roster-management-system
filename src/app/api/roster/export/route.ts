import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getRosterWorkspaceData } from "@/lib/queries/roster-queries";
import { formatMonthYear, toDateKey } from "@/lib/utils";

const STATUS_SHORT: Record<string, string> = {
  WORKING: "W",
  WEEKLY_OFF: "WO",
  PUBLIC_HOLIDAY: "PH",
  PLANNED_LEAVE: "PL",
  COMP_OFF: "CO",
  UNAVAILABLE: "UA",
};

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rosterId = searchParams.get("rosterId") ?? undefined;
  const format = searchParams.get("format") ?? "csv";

  const data = await getRosterWorkspaceData({ rosterId });
  if (!data.roster) {
    return NextResponse.json({ error: "Roster not found" }, { status: 404 });
  }

  const entryMap = new Map(
    data.roster.entries.map((e) => [`${e.employeeId}::${toDateKey(e.date)}`, e])
  );

  const headers = [
    "Employee",
    "Role",
    "Pod",
    "Primary Brands",
    ...data.calendar.map((d) => d.dateKey),
    "Working Days",
    "Weekly Offs",
    "Leaves/Holidays",
  ];

  const rows: string[][] = [];
  for (const emp of data.employees.filter((e) => e.active)) {
    const primaryBrands = Array.from(
      new Set(
        emp.assignments
          .filter((a) => a.allocationType === "PRIMARY")
          .map((a) => a.brand.code)
      )
    ).join(" / ");

    let working = 0;
    let offs = 0;
    let leaves = 0;

    const dayCells = data.calendar.map((d) => {
      const entry = entryMap.get(`${emp.id}::${d.dateKey}`);
      if (!entry) return "";
      if (entry.status === "WORKING") working++;
      else if (entry.status === "WEEKLY_OFF") offs++;
      else leaves++;

      const code = STATUS_SHORT[entry.status] ?? entry.status;
      if (entry.status === "WORKING" && entry.allocations.length > 0) {
        const hasBackup = entry.allocations.some((a) => a.isBackup);
        return hasBackup ? `${code} (BK)` : code;
      }
      return code;
    });

    rows.push([
      emp.name,
      emp.role,
      emp.pod.name,
      primaryBrands || "Backup Float",
      ...dayCells,
      String(working),
      String(offs),
      String(leaves),
    ]);
  }

  const filenameBase = `smart-roster-${data.roster.year}-${String(
    data.roster.month
  ).padStart(2, "0")}`;

  if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      formatMonthYear(data.roster.month, data.roster.year).slice(0, 31)
    );
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filenameBase}.xlsx"`,
      },
    });
  }

  const csvLines = [headers, ...rows].map((row) =>
    row.map(escapeCsv).join(",")
  );
  return new NextResponse(csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
    },
  });
}
