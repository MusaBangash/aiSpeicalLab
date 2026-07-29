import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { BADGE_INFO } from "@/lib/badges";
import type { BadgeType } from "@prisma/client";
import { PageHeader } from "@/components/shell/PageHeader";
import { Certificate } from "@/components/certificates/Certificate";

export default async function StudentBadgeCertificatePage({ params }: { params: Promise<{ type: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const { type } = await params;
  if (!(type in BADGE_INFO)) redirect("/student/progress");
  const badgeType = type as BadgeType;

  const [badge, user] = await Promise.all([
    db.studentBadge.findUnique({ where: { studentId_type: { studentId: session.user.id, type: badgeType } } }),
    db.user.findUnique({ where: { id: session.user.id }, include: { lab: true } }),
  ]);
  if (!badge) redirect("/student/progress"); // not earned yet — nothing to show

  return (
    <div className="page-anim">
      <div className="no-print">
        <PageHeader title="Certificate" />
      </div>
      <Certificate
        labName={user?.lab?.name ?? null}
        studentName={session.user.name ?? ""}
        achievementTitle={`has earned the "${BADGE_INFO[badgeType].label}" badge`}
        dateLabel="Earned on"
        date={badge.earnedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      />
    </div>
  );
}
