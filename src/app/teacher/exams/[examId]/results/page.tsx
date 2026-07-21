/** Teacher: results per student — official score + full attempt history */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shell/PageHeader";
import { ResultsTable } from "@/components/exams/ResultsTable";

export default async function ResultsPage({ params }: { params: Promise<{ examId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const { examId } = await params;
  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) redirect("/teacher/exams");

  const [students, records, attempts] = await Promise.all([
    db.user.findMany({ where: { role: "STUDENT" }, orderBy: { name: "asc" } }),
    db.examRecord.findMany({ where: { examId } }),
    db.examAttempt.findMany({ where: { examId }, orderBy: { attemptNumber: "asc" } }),
  ]);

  const rows = students.map((student) => ({
    studentId: student.id,
    name: student.name,
    email: student.email,
    record: records.find((r) => r.studentId === student.id) ?? null,
    attempts: attempts.filter((a) => a.studentId === student.id),
  }));

  return (
    <div className="page-anim">
      <PageHeader title={`${exam.title} — Results`} />
      <div className="print-only" style={{ marginBottom: 16 }}>
        <h2>{exam.title} — Results</h2>
        <p>Generated {new Date().toLocaleDateString("en-GB", { dateStyle: "long" })}</p>
      </div>
      <ResultsTable rows={rows} examTitle={exam.title} />
    </div>
  );
}
