import { prisma } from "@/lib/db";
import { toDateKey } from "@/lib/utils";
import { TimeOffsManager } from "@/components/manage/time-offs-manager";

export const dynamic = "force-dynamic";

export default async function TimeOffsPage() {
  const [timeOffs, employees] = await Promise.all([
    prisma.timeOff.findMany({
      orderBy: [{ date: "asc" }, { employee: { name: "asc" } }],
      include: {
        employee: { include: { pod: { select: { name: true } } } },
      },
    }),
    prisma.employee.findMany({
      orderBy: { name: "asc" },
      include: { pod: { select: { name: true } } },
    }),
  ]);

  return (
    <TimeOffsManager
      timeOffs={timeOffs.map((t) => ({
        id: t.id,
        employeeId: t.employeeId,
        employeeName: t.employee.name,
        podName: t.employee.pod.name,
        dateKey: toDateKey(t.date),
        type: t.type,
        status: t.status,
        reason: t.reason,
      }))}
      employees={employees.map((e) => ({
        id: e.id,
        name: e.name,
        podName: e.pod.name,
      }))}
    />
  );
}
