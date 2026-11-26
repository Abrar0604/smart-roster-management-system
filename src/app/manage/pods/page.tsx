import { prisma } from "@/lib/db";
import { PodsManager } from "@/components/manage/pods-manager";

export const dynamic = "force-dynamic";

export default async function PodsPage() {
  const [pods, employees] = await Promise.all([
    prisma.pod.findMany({
      orderBy: { name: "asc" },
      include: {
        lead: { select: { name: true } },
        _count: { select: { employees: true } },
      },
    }),
    prisma.employee.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  return (
    <PodsManager
      pods={pods.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        leadId: p.leadId,
        leadName: p.lead?.name ?? null,
        employeeCount: p._count.employees,
      }))}
      employees={employees}
    />
  );
}
