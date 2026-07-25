/** Teacher: question bank editor (MCQ + options, mark correct, retire) */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shell/PageHeader";
import { QuestionBankEditor, type QuestionStats } from "@/components/exams/QuestionBankEditor";
import { PrintExamPaper } from "@/components/exams/PrintExamPaper";

export default async function QuestionsPage({ params }: { params: Promise<{ examId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const { examId } = await params;
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
    },
  });
  if (!exam) redirect("/teacher/exams");

  const modules = await db.curriculumModule.findMany({ orderBy: { order: "asc" } });
  const examModuleTitle = modules.find((m) => m.id === exam.moduleId)?.title ?? "";

  // Difficulty stats: how often each question has been answered correctly,
  // across every attempt of this exam ever taken (not just the current bank).
  const questionIds = exam.questions.map((q) => q.id);
  const answers = await db.attemptAnswer.findMany({
    where: { questionId: { in: questionIds }, optionId: { not: null } },
    select: { questionId: true, optionId: true },
  });
  const stats: Record<string, QuestionStats> = {};
  for (const q of exam.questions) {
    const correctOptionId = q.options.find((o) => o.isCorrect)?.id;
    const answered = answers.filter((a) => a.questionId === q.id);
    stats[q.id] = {
      total: answered.length,
      correct: answered.filter((a) => a.optionId === correctOptionId).length,
    };
  }

  return (
    <div className="page-anim">
      <div className="no-print">
        <PageHeader title={`${exam.title} — Questions`} />
      </div>
      <PrintExamPaper examTitle={exam.title} questions={exam.questions} />
      <div className="no-print">
        <QuestionBankEditor
          examId={examId}
          examStatus={exam.status}
          questionsShown={exam.questionsShown}
          initialQuestions={exam.questions}
          stats={stats}
          modules={modules}
          examModuleTitle={examModuleTitle}
        />
      </div>
    </div>
  );
}
