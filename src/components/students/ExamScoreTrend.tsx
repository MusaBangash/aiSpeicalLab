import { db } from "@/lib/db";
import { Card } from "@/components/ui/Card";

export async function ExamScoreTrend({ studentId }: { studentId: string }) {
  const records = await db.examRecord.findMany({ where: { studentId }, orderBy: { updatedAt: "asc" } });
  // ExamRecord has no Prisma relation to Exam — look titles up separately, same pattern as getStudentDashboard.
  const exams = await db.exam.findMany({ where: { id: { in: records.map((r) => r.examId) } } });
  const examTitle = (examId: string) => exams.find((e) => e.id === examId)?.title ?? "Exam";

  if (records.length === 0) {
    return (
      <Card className="feed-card" style={{ marginBottom: "var(--space-6)" }}>
        <div className="feed-title">Exam score trend</div>
        <div className="feed-empty">No exam records yet.</div>
      </Card>
    );
  }

  const WIDTH = 400;
  const HEIGHT = 140;
  const PAD = 16;
  const points = records.map((r, i) => ({
    x: records.length === 1 ? WIDTH / 2 : PAD + (i / (records.length - 1)) * (WIDTH - PAD * 2),
    y: PAD + (1 - r.scorePercent / 100) * (HEIGHT - PAD * 2),
    r,
  }));

  return (
    <Card className="feed-card" style={{ marginBottom: "var(--space-6)" }}>
      <div className="feed-title">Exam score trend</div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT} preserveAspectRatio="none">
        {points.length > 1 ? (
          <polyline
            fill="none"
            stroke="var(--gold)"
            strokeWidth="2"
            points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          />
        ) : null}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4} fill={p.r.passed ? "var(--gold)" : "var(--coral)"}>
            <title>
              {examTitle(p.r.examId)} — {p.r.scorePercent}% ({p.r.passed ? "passed" : "failed"}) ·{" "}
              {p.r.updatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </title>
          </circle>
        ))}
      </svg>
    </Card>
  );
}
