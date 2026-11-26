import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function LatestRosterRedirectPage() {
  const latest = await prisma.roster.findFirst({
    orderBy: [{ year: "desc" }, { month: "desc" }],
    select: { id: true },
  });

  if (latest) {
    redirect(`/roster/${latest.id}`);
  }
  redirect("/roster/generate");
}
