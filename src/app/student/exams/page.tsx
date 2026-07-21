/** Exams list — published exams with state per student: available / in progress / cooldown / sealed. */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canStartAttempt } from "@/lib/exam";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";

export default async function StudentExamsPage() {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const exams = await db.exam.findMany({
    where: { status: "PUBLISHED" },
    include: { module: true },
    orderBy: { createdAt: "asc" },
  });
  const states = await Promise.all(exams.map((exam) => canStartAttempt(session.user.id, exam.id)));

  return (
    <div className="page-anim">
      <PageHeader title="Exams" />
      <div className="exam-list">
        {exams.length === 0 ? (
          <Card style={{ padding: 24 }}>No exams published yet.</Card>
        ) : (
          exams.map((exam, i) => {
            const state = states[i];
            return (
              <Card key={exam.id} className="exam-row">
                <div className="exam-row-body">
                  <div className="exam-row-title">{exam.title}</div>
                  <div className="exam-row-sub">
                    {exam.module.title} · {exam.durationMinutes} min · {exam.questionsShown} questions · pass at{" "}
                    {exam.passMarkPercent}%
                  </div>
                </div>
                {state.blocked && state.reason === "SEALED" ? (
                  <>
                    <Chip variant="done">Sealed · {state.scorePercent}%</Chip>
                  </>
                ) : state.blocked && state.reason === "IN_PROGRESS" ? (
                  <Link href={`/student/exams/${exam.id}/take`} className="btn">
                    Resume
                  </Link>
                ) : state.blocked && state.reason === "NOT_YET_OPEN" ? (
                  <Chip variant="locked">
                    Opens {state.opensAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </Chip>
                ) : state.blocked && state.reason === "CLOSED" ? (
                  <Chip variant="coral">Closed</Chip>
                ) : state.blocked && state.reason === "COOLDOWN" ? (
                  <Chip variant="locked">
                    Retake after {state.availableAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  </Chip>
                ) : (
                  <Link href={`/student/exams/${exam.id}/take`} className="btn">
                    Begin exam
                  </Link>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
