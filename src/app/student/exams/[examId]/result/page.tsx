/** Result screen — animated score ring, pass/fail messaging, verification ID. */
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getAttemptScoreBreakdown } from "@/lib/exam";
import { ScoreRing } from "@/components/exams/ScoreRing";
import { Confetti } from "@/components/exams/Confetti";

export default async function ExamResultPage({ params }: { params: Promise<{ examId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const { examId } = await params;
  const record = await db.examRecord.findUnique({
    where: { examId_studentId: { examId, studentId: session.user.id } },
  });
  if (!record) redirect("/student/exams");

  const [exam, attempt, breakdown] = await Promise.all([
    db.exam.findUniqueOrThrow({ where: { id: examId } }),
    db.examAttempt.findUniqueOrThrow({ where: { id: record.latestAttemptId } }),
    getAttemptScoreBreakdown(record.latestAttemptId),
  ]);

  const auto = attempt.status === "AUTO_SUBMITTED";
  const usedMs =
    attempt.finishedAt && attempt.startedAt ? attempt.finishedAt.getTime() - attempt.startedAt.getTime() : 0;
  const usedMin = Math.floor(usedMs / 60000);
  const usedSec = Math.floor((usedMs % 60000) / 1000);

  const cooldownAvailableAt = attempt.finishedAt
    ? new Date(attempt.finishedAt.getTime() + exam.cooldownHours * 60 * 60 * 1000)
    : null;

  return (
    <div className="stage">
      <div className="result">
        <ScoreRing scorePercent={record.scorePercent} passed={record.passed} />
        <div className={"verdict " + (record.passed ? "pass" : "fail")}>
          {record.passed
            ? auto
              ? "Time up — but you passed!"
              : "Passed — well done!"
            : auto
              ? "Time up — not this time"
              : "Not this time"}
        </div>
        <p className="r-sub">
          {record.passed
            ? "This exam is complete and sealed — no further attempts are needed."
            : `You need ${exam.passMarkPercent}% to pass. You can retake this exam ${
                cooldownAvailableAt
                  ? `after ${cooldownAvailableAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
                  : "after the cooldown"
              } — a fresh set of questions will be drawn, and only your latest score counts.`}
        </p>
        <div className="r-cards">
          <div className="r-chip">
            <div className="v">
              {breakdown.correctCount} / {breakdown.totalCount}
            </div>
            <div className="k">Correct</div>
          </div>
          <div className="r-chip">
            <div className="v">
              {usedMin}m {usedSec < 10 ? "0" : ""}
              {usedSec}s
            </div>
            <div className="k">Time used</div>
          </div>
          <div className="r-chip">
            <div className="v">{record.verificationId}</div>
            <div className="k">Verification ID</div>
          </div>
        </div>
        <Link href="/student/exams" className="btn">
          Back to exams
        </Link>
      </div>
      {record.passed ? <Confetti /> : null}
    </div>
  );
}
