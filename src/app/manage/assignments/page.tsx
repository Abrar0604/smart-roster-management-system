import { prisma } from "@/lib/db";
import { AssignmentsManager } from "@/components/manage/assignments-manager";

export const dynamic = "force-dynamic";

export default async function AssignmentsPage() {
  const [assignments, employees, brands, processes] = await Promise.all([
    prisma.assignment.findMany({
      orderBy: [{ brand: { name: "asc" } }, { process: { code: "asc" } }],
      include: {
        employee: { include: { pod: { select: { name: true } } } },
        brand: { select: { name: true, code: true } },
        process: { select: { code: true } },
      },
    }),
    prisma.employee.findMany({
      orderBy: { name: "asc" },
      include: { pod: { select: { name: true } } },
    }),
    prisma.brand.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.process.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
  ]);

  return (
    <AssignmentsManager
      assignments={assignments.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        employeeName: a.employee.name,
        podName: a.employee.pod.name,
        brandId: a.brandId,
        brandName: a.brand.name,
        brandCode: a.brand.code,
        processId: a.processId,
        processCode: a.process.code,
        allocationType: a.allocationType,
        shiftWindow: a.shiftWindow,
        capacityWeight: a.capacityWeight,
        priority: a.priority,
      }))}
      employees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        podName: e.pod.name,
      }))}
      brands={brands}
      processes={processes}
    />
  );
}
