import { prisma } from "@/lib/db";
import { toDateKey } from "@/lib/utils";
import { HolidaysManager } from "@/components/manage/holidays-manager";

export const dynamic = "force-dynamic";

export default async function HolidaysPage() {
  const [holidays, brands] = await Promise.all([
    prisma.publicHoliday.findMany({ orderBy: { date: "asc" } }),
    prisma.brand.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
  ]);

  const brandMap = new Map(brands.map((b) => [b.id, `${b.name} (${b.code})`]));

  return (
    <HolidaysManager
      holidays={holidays.map((h) => ({
        id: h.id,
        dateKey: toDateKey(h.date),
        name: h.name,
        scope: h.scope,
        scopeLabel:
          h.scope === "GLOBAL"
            ? "Global (All Brands)"
            : (brandMap.get(h.scope) ?? h.scope),
      }))}
      brands={brands}
    />
  );
}
