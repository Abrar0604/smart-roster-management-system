import { prisma } from "@/lib/db";
import { EmployeesManager } from "@/components/manage/employees-manager";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const [employees, pods] = await Promise.all([
    prisma.employee.findMany({
      orderBy: [{ pod: { name: "asc" } }, { name: "asc" }],
      include: {
        pod: { select: { name: true } },
        assignments: { select: { brandId: true } },
      },
    }),
    prisma.pod.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <EmployeesManager
      employees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        email: e.email,
        role: e.role,
        podId: e.podId,
        podName: e.pod.name,
        maxWeeklyWorkdays: e.maxWeeklyWorkdays,
        preferredOffDay: e.preferredOffDay,
        shiftWindow: e.shiftWindow,
        active: e.active,
        brandCount: new Set(e.assignments.map((a) => a.brandId)).size,
      }))}
      pods={pods}
    />
  );
}
