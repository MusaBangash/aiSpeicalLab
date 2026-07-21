/** Teacher: one student's exam avg, attendance %, category averages, journal history + entry form */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudentMetrics, JOURNAL_CATEGORIES } from "@/lib/metrics";
import { getStudentActivity, isIdle } from "@/lib/activity";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";
import { JournalEntryForm } from "@/components/metrics/JournalEntryForm";
import { JournalHistoryList } from "@/components/metrics/JournalHistoryList";
import { getRecordingsForStudent } from "@/lib/screenView";
import { ScreenViewPanel } from "@/components/screenview/ScreenViewPanel";
import Link from "next/link";

const CATEGORY_LABELS: Record<string, string> = {
  PARTICIPATION: "Participation",
  BEHAVIOUR: "Behaviour",
  EXTRA_ACTIVITY: "Extra activity",
};

export default async function TeacherStudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const { studentId } = await params;
  const student = await db.user.findUnique({ where: { id: studentId } });
  if (!student || student.role !== "STUDENT") redirect("/teacher/students");

  const [metrics, activity, recordings] = await Promise.all([
    getStudentMetrics(studentId),
    getStudentActivity(studentId),
    getRecordingsForStudent(session.user.id, studentId),
  ]);

  return (
    <div className="page-anim">
      <PageHeader title={student.name} />
      <div className="hero-grid">
        <Card className="mini-card">
          <div className="mini-top">
            <div className="mini-icon l">
              <Icon name="trophy" size={18} />
            </div>
          </div>
          <div className="mini-num">{metrics.avgScorePercent}%</div>
          <div className="mini-label">Average exam score</div>
        </Card>
        <Card className="mini-card">
          <div className="mini-top">
            <div className="mini-icon g">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="mini-num">{metrics.attendancePercent}%</div>
          <div className="mini-label">Attendance this term</div>
        </Card>
        {JOURNAL_CATEGORIES.map((cat) => (
          <Card className="mini-card" key={cat}>
            <div className="mini-top">
              <div className="mini-icon g">
                <Icon name="star" size={18} />
              </div>
            </div>
            <div className="mini-num">
              {metrics.categoryAverages[cat] !== null ? `${metrics.categoryAverages[cat]} / 5` : "—"}
            </div>
            <div className="mini-label">{CATEGORY_LABELS[cat]}</div>
          </Card>
        ))}
      </div>

      <Card className="feed-card" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="feed-title">Activity</div>
        {activity.current ? (
          <div className="feed-item">
            <div className={"feed-dot " + (isIdle(activity.current.idleSeconds) ? "g" : "l")}>
              <Icon name="clock" size={16} />
            </div>
            <div>
              <div className="feed-t">
                {activity.current.appName} — {activity.current.windowTitle || "(no title)"}
              </div>
              <div className="feed-s">
                {activity.current.pcHostname} · {isIdle(activity.current.idleSeconds) ? "Idle" : "Active"} · updated{" "}
                {activity.current.lastSeenAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ) : (
          <div className="feed-empty">No recent activity.</div>
        )}
      </Card>

      <Card className="feed-card" style={{ marginBottom: 16 }}>
        <div className="feed-title">Recent sessions</div>
        {activity.recent.length === 0 ? (
          <div className="feed-empty">No history yet.</div>
        ) : (
          activity.recent.map((seg) => (
            <div key={seg.id} className="feed-item">
              <div className={"feed-dot " + (isIdle(seg.idleSeconds) ? "g" : "l")}>
                <Icon name="clock" size={16} />
              </div>
              <div>
                <div className="feed-t">
                  {seg.appName} — {seg.windowTitle || "(no title)"}
                </div>
                <div className="feed-s">
                  {Math.round(seg.durationSeconds / 60)} min ·{" "}
                  {seg.startedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{" "}
                  {seg.startedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  {isIdle(seg.idleSeconds) ? " · idle at last check" : ""}
                </div>
              </div>
            </div>
          ))
        )}
      </Card>

      <Card className="feed-card" style={{ marginBottom: 16 }}>
        <div className="feed-title">Screen view</div>
        <ScreenViewPanel studentId={student.id} />
      </Card>

      {recordings.length > 0 ? (
        <Card className="feed-card" style={{ marginBottom: 16 }}>
          <div className="feed-title">Saved recordings</div>
          {recordings.map((r) => (
            <Link key={r.id} href={`/teacher/recordings/${r.id}`} className="feed-item" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="feed-dot g">
                <Icon name="clock" size={16} />
              </div>
              <div>
                <div className="feed-t">{r.frameCount} frames</div>
                <div className="feed-s">
                  {r.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{" "}
                  {r.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </Link>
          ))}
        </Card>
      ) : null}

      <Card style={{ padding: 0, marginTop: 16, marginBottom: 16 }}>
        <JournalEntryForm studentId={student.id} />
      </Card>

      <JournalHistoryList
        entries={metrics.entries.map((e) => ({
          id: e.id,
          category: e.category,
          rating: e.rating,
          note: e.note,
          createdAt: e.createdAt.toISOString(),
          teacherName: e.teacherName,
          status: e.status,
          correctedFromRating: e.correctedFromRating,
          canManage: e.teacherId === session.user.id,
        }))}
      />
    </div>
  );
}
