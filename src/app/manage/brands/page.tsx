import { prisma } from "@/lib/db";
import { BrandsManager } from "@/components/manage/brands-manager";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const [brands, processes] = await Promise.all([
    prisma.brand.findMany({
      orderBy: { name: "asc" },
      include: {
        processConfigs: {
          include: { process: true },
          orderBy: { process: { code: "asc" } },
        },
        assignments: {
          where: { allocationType: "PRIMARY" },
          select: { employeeId: true },
        },
      },
    }),
    prisma.process.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return (
    <BrandsManager
      brands={brands.map((b) => ({
        id: b.id,
        name: b.name,
        code: b.code,
        category: b.category,
        description: b.description,
        active: b.active,
        primaryEmployeeCount: new Set(b.assignments.map((a) => a.employeeId)).size,
        configs: b.processConfigs.map((c) => ({
          id: c.id,
          processId: c.processId,
          processCode: c.process.code,
          processName: c.process.name,
          operatingRule: c.operatingRule,
          shiftWindow: c.shiftWindow,
          minStaff: c.minStaff,
          dayOverrides: c.dayOverrides,
        })),
      }))}
      processes={processes}
    />
  );
}
