/** Exam-taking screen (timer, navigator, auto-save) — see docs/design/exam_ui.html */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canStartAttempt } from "@/lib/exam";
import { TakeExamClient } from "@/components/exams/TakeExamClient";

export default async function TakeExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const { examId } = await params;
  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam || exam.status !== "PUBLISHED") redirect("/student/exams");

  const block = await canStartAttempt(session.user.id, examId);
  // Sealed/on-cooldown students shouldn't land here at all (defends direct URL entry).
  if (block.blocked && block.reason !== "IN_PROGRESS") redirect("/student/exams");

  return (
    <TakeExamClient
      examId={examId}
      examTitle={exam.title}
      durationMinutes={exam.durationMinutes}
      questionsShown={exam.questionsShown}
      studentName={session.user.name ?? ""}
      autoStart={block.blocked && block.reason === "IN_PROGRESS"}
    />
  );
}
