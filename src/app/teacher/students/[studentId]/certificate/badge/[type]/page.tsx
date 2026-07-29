import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { BADGE_INFO } from "@/lib/badges";
import type { BadgeType } from "@prisma/client";
import { PageHeader } from "@/components/shell/PageHeader";
import { Certificate } from "@/components/certificates/Certificate";

export default async function TeacherBadgeCertificatePage({
  params,
}: {
  params: Promise<{ studentId: string; type: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const { studentId, type } = await params;
  if (!(type in BADGE_INFO)) redirect(`/teacher/students/${studentId}`);
  const badgeType = type as BadgeType;

  const [badge, student] = await Promise.all([
    db.studentBadge.findUnique({ where: { studentId_type: { studentId, type: badgeType } } }),
    db.user.findUnique({ where: { id: studentId }, include: { lab: true } }),
  ]);
  if (!badge || !student || student.role !== "STUDENT") redirect(`/teacher/students/${studentId}`);

  return (
    <div className="page-anim">
      <div className="no-print">
        <PageHeader title="Certificate" />
      </div>
      <Certificate
        labName={student.lab?.name ?? null}
        studentName={student.name}
        achievementTitle={`has earned the "${BADGE_INFO[badgeType].label}" badge`}
        dateLabel="Earned on"
        date={badge.earnedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      />
    </div>
  );
}
