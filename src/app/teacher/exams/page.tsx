/** Teacher: exam list and status */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shell/PageHeader";
import { ExamListClient, type ExamListRow } from "@/components/exams/ExamListClient";

export default async function TeacherExamsPage() {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const exams = await db.exam.findMany({
    include: {
      module: true,
      _count: { select: { questions: { where: { active: true } }, attempts: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const records = await db.examRecord.findMany({
    where: { examId: { in: exams.map((e) => e.id) } },
    select: { examId: true, passed: true },
  });

  const rows: ExamListRow[] = exams.map((exam) => {
    const examRecords = records.filter((r) => r.examId === exam.id);
    return {
      id: exam.id,
      title: exam.title,
      status: exam.status,
      moduleTitle: exam.module.title,
      activeQuestionCount: exam._count.questions,
      questionsShown: exam.questionsShown,
      attemptsCount: exam._count.attempts,
      passRatePercent:
        examRecords.length > 0
          ? Math.round((100 * examRecords.filter((r) => r.passed).length) / examRecords.length)
          : null,
      createdAt: exam.createdAt.toISOString(),
      opensAt: exam.opensAt?.toISOString() ?? null,
      closesAt: exam.closesAt?.toISOString() ?? null,
    };
  });

  return (
    <div className="page-anim">
      <PageHeader title="Exams" />
      <div style={{ marginBottom: 16 }}>
        <Link href="/teacher/exams/new" className="btn">
          New exam
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          No exams yet — create one to get started.
        </div>
      ) : (
        <ExamListClient rows={rows} />
      )}
    </div>
  );
}
