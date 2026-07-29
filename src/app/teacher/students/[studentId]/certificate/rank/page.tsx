import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudentRankStatus } from "@/lib/rank";
import { PageHeader } from "@/components/shell/PageHeader";
import { Certificate } from "@/components/certificates/Certificate";

export default async function TeacherRankCertificatePage({ params }: { params: Promise<{ studentId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const { studentId } = await params;
  const student = await db.user.findUnique({ where: { id: studentId }, include: { lab: true } });
  if (!student || student.role !== "STUDENT") redirect("/teacher/students");

  const rankStatus = await getStudentRankStatus(studentId);

  return (
    <div className="page-anim">
      <div className="no-print">
        <PageHeader title="Certificate" />
      </div>
      <Certificate
        labName={student.lab?.name ?? null}
        studentName={student.name}
        achievementTitle={`has achieved the rank of ${rankStatus.rank.currentRank}`}
        dateLabel="Issued on"
        date={new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      />
    </div>
  );
}
