import { prisma } from "@/lib/db";
import { getAllRostersSummary } from "@/lib/queries/roster-queries";
import { GeneratorClient } from "@/components/roster/generator-client";

export const dynamic = "force-dynamic";

export default async function GenerateRosterPage() {
  const [rosters, activeEmployees, brands, pods, configs] = await Promise.all([
    getAllRostersSummary(),
    prisma.employee.count({ where: { active: true } }),
    prisma.brand.count({ where: { active: true } }),
    prisma.pod.count(),
    prisma.brandProcessConfig.count({ where: { active: true } }),
  ]);

  return (
    <GeneratorClient
      rosters={rosters.map((r) => ({
        id: r.id,
        month: r.month,
        year: r.year,
        status: r.status,
        generatedAt: r.generatedAt.toISOString(),
        entryCount: r._count.entries,
        hardConflicts: r.conflicts.filter((c) => c.severity === "HARD").length,
        softConflicts: r.conflicts.filter((c) => c.severity === "SOFT").length,
      }))}
      counts={{ activeEmployees, brands, pods, configs }}
    />
  );
}
