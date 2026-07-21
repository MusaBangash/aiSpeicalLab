/**
 * Teacher: preview the full active question bank read-only, exactly as
 * a student would see each question — but with the correct answer
 * marked. Creates no ExamAttempt; this is not a graded attempt.
 */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shell/PageHeader";
import { Icon } from "@/components/shell/Icon";

const KEYS = ["A", "B", "C", "D"];

export default async function PreviewExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const { examId } = await params;
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: {
      questions: {
        where: { active: true },
        orderBy: { id: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!exam) redirect("/teacher/exams");

  return (
    <div className="page-anim">
      <PageHeader title={`${exam.title} — Preview`} />
      <div
        className="card"
        style={{
          padding: "14px 20px",
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          gap: 10,
          color: "var(--gold-dark)",
          background: "var(--gold-mist)",
        }}
      >
        <Icon name="shield" size={18} />
        Preview only — this is not a graded attempt. Correct answers are marked for your reference.
      </div>

      {exam.questions.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          No active questions in the bank yet.
        </div>
      ) : (
        exam.questions.map((q, i) => (
          <div key={q.id} className="qcard" style={{ marginBottom: 16 }}>
            <div className="q-eyebrow">
              <span className="q-num">
                Question {i + 1} of {exam.questions.length}
              </span>
            </div>
            <div className="q-text">{q.text}</div>
            <div>
              {q.options.map((opt, oi) => (
                <div key={opt.id} className={"opt" + (opt.isCorrect ? " sel" : "")} style={{ cursor: "default" }}>
                  <div className="opt-key">{opt.isCorrect ? <Icon name="check" size={16} /> : KEYS[oi]}</div>
                  <div className="opt-txt">{opt.text}</div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
