import { prisma } from "@/lib/db";
import { ProcessesManager } from "@/components/manage/processes-manager";

export const dynamic = "force-dynamic";

export default async function ProcessesPage() {
  const processes = await prisma.process.findMany({
    orderBy: { code: "asc" },
    include: {
      _count: {
        select: {
          processConfigs: true,
          assignments: true,
        },
      },
    },
  });

  return (
    <ProcessesManager
      processes={processes.map((p) => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        brandCount: p._count.processConfigs,
        assignmentCount: p._count.assignments,
      }))}
    />
  );
}
