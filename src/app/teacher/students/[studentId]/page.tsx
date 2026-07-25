/** Teacher: one student's exam avg, attendance %, category averages, journal history + entry form */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudentMetrics, JOURNAL_CATEGORIES } from "@/lib/metrics";
import { getStudentActivity, isIdle } from "@/lib/activity";
import { getStudentJoinDate } from "@/lib/classes";
import { getExamCounts } from "@/lib/dashboard";
import { computeLongestStreak, countDaysPresent, getStudentMonthAttendanceCells, listMonthsDescending } from "@/lib/attendance";
import { getStudentRankStatus } from "@/lib/rank";
import { getBadgeShelf } from "@/lib/badges";
import { RankLadderCard } from "@/components/rank/RankLadderCard";
import { BadgeShelf } from "@/components/rank/BadgeShelf";
import { BadgeAwardActions } from "@/components/rank/BadgeAwardActions";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";
import { JournalEntryForm } from "@/components/metrics/JournalEntryForm";
import { JournalHistoryList } from "@/components/metrics/JournalHistoryList";
import { JournalTimeline } from "@/components/metrics/JournalTimeline";
import { getRecordingsForStudent } from "@/lib/screenView";
import { ScreenViewPanel } from "@/components/screenview/ScreenViewPanel";
import { MonthHeatmapGrid } from "@/components/attendance/MonthHeatmapGrid";
import { ExamScoreTrend } from "@/components/students/ExamScoreTrend";
import { StudentSummaryStrip } from "@/components/students/StudentSummaryStrip";
import { ResetPasswordAction } from "@/components/students/ResetPasswordAction";
import { TopicBreakdown } from "@/components/students/TopicBreakdown";
import Link from "next/link";

const CATEGORY_LABELS: Record<string, string> = {
  PARTICIPATION: "Participation",
  BEHAVIOUR: "Behaviour",
  EXTRA_ACTIVITY: "Extra activity",
};

const COURSE_TYPE_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  DIPLOMA: "Diploma",
  OTHER: "Other",
};

const CATEGORY_TYPE_LABELS: Record<string, string> = {
  PAYING: "Paying",
  ORPHAN: "Orphan",
  STAFF: "Staff",
  OTHER: "Other",
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

  const [metrics, activity, recordings, profile, joinDate, allAttendance, examCounts, rankStatus, badgeShelf] = await Promise.all([
    getStudentMetrics(studentId),
    getStudentActivity(studentId),
    getRecordingsForStudent(session.user.id, studentId),
    db.studentProfile.findUnique({ where: { userId: studentId } }),
    getStudentJoinDate(studentId),
    db.attendance.findMany({ where: { studentId } }), // all-time — reused for BOTH longest streak AND total-days-present
    getExamCounts(studentId),
    getStudentRankStatus(studentId),
    getBadgeShelf(studentId),
  ]);

  const longestStreak = computeLongestStreak(allAttendance);
  const totalDaysPresent = countDaysPresent(allAttendance);
  const months = joinDate ? listMonthsDescending(joinDate, new Date()) : [];
  const monthCells = await Promise.all(months.map((m) => getStudentMonthAttendanceCells(studentId, m.year, m.month)));

  const journalEntries = metrics.entries.map((e) => ({
    id: e.id,
    category: e.category,
    rating: e.rating,
    note: e.note,
    createdAt: e.createdAt.toISOString(),
    teacherName: e.teacherName,
    status: e.status,
    correctedFromRating: e.correctedFromRating,
    canManage: e.teacherId === session.user.id,
  }));

  return (
    <div className="page-anim">
      <PageHeader title={student.name} />

      {profile ? (
        <Card className="feed-card" style={{ marginBottom: 16, display: "flex", gap: 20, alignItems: "flex-start" }}>
          {profile.photoPath ? (
            <img
              src={`/api/students/${student.id}/photo`}
              alt={student.name}
              style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 12, flexShrink: 0 }}
            />
          ) : null}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", fontSize: 14 }}>
            <div><span style={{ color: "var(--muted)" }}>Father&apos;s name:</span> {profile.fatherName}</div>
            <div><span style={{ color: "var(--muted)" }}>Contact:</span> {profile.contact}</div>
            <div><span style={{ color: "var(--muted)" }}>Address:</span> {profile.address}</div>
            <div><span style={{ color: "var(--muted)" }}>Gender:</span> {profile.gender}</div>
            <div>
              <span style={{ color: "var(--muted)" }}>Course type:</span>{" "}
              {profile.courseType === "OTHER" ? profile.courseTypeOther : COURSE_TYPE_LABELS[profile.courseType]}
            </div>
            <div><span style={{ color: "var(--muted)" }}>Category:</span> {CATEGORY_TYPE_LABELS[profile.category]}</div>
            <div>
              <span style={{ color: "var(--muted)" }}>Residency:</span>{" "}
              {profile.residency === "DAY_SCHOLAR" ? "Day scholar" : "Hostelized"}
            </div>
            <div><span style={{ color: "var(--muted)" }}>Education:</span> {profile.educationLevel} — {profile.educationStatus}</div>
          </div>
        </Card>
      ) : null}

      <div style={{ marginBottom: 16 }}>
        <ResetPasswordAction studentId={studentId} studentName={student.name} />
      </div>

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

      <StudentSummaryStrip
        joinedDate={joinDate}
        totalDaysPresent={totalDaysPresent}
        longestStreak={longestStreak}
        examsTaken={examCounts.examsTaken}
        examsPassed={examCounts.examsPassed}
      />

      <Card className="feed-card" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="feed-title">Rank &amp; Badges</div>
        <RankLadderCard status={rankStatus} />
        <BadgeShelf badges={badgeShelf} />
        <BadgeAwardActions
          studentId={studentId}
          projectCompleteEarnedAt={badgeShelf.find((b) => b.type === "PROJECT_COMPLETE")?.earnedAt ?? null}
          nominationEarnedAt={badgeShelf.find((b) => b.type === "MASTER_ENGINEER_NOMINATION")?.earnedAt ?? null}
          nominationEligible={rankStatus.tenureMonths >= 24 && rankStatus.points.total >= 400}
        />
      </Card>

      {joinDate ? (
        <>
          <div className="rc-title" style={{ marginTop: 24 }}>
            Attendance history
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {months.map((m, i) => (
              <MonthHeatmapGrid key={`${m.year}-${m.month}`} year={m.year} month={m.month} cells={monthCells[i]} />
            ))}
          </div>
          <div className="legend" style={{ marginBottom: 24 }}>
            <span className="lg">
              <i style={{ background: "var(--gold)" }} />
              Present
            </span>
            <span className="lg">
              <i style={{ background: "var(--gold-soft)", border: "1.5px solid var(--gold)" }} />
              Late
            </span>
            <span className="lg">
              <i style={{ background: "var(--coral-soft)" }} />
              Absent
            </span>
            <span className="lg">
              <i style={{ background: "var(--leaf-soft)" }} />
              Excused
            </span>
            <span className="lg">
              <i style={{ background: "var(--gold-mist)" }} />
              Weekend / holiday
            </span>
          </div>
        </>
      ) : (
        <div className="feed-empty">No enrollment history yet.</div>
      )}

      <ExamScoreTrend studentId={studentId} />
      <TopicBreakdown studentId={studentId} />

      <Card className="feed-card" style={{ marginTop: 16, marginBottom: 16 }}>
        <div className="feed-title">Journal timeline</div>
        <JournalTimeline entries={journalEntries} />
      </Card>

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

      <JournalHistoryList entries={journalEntries} />
    </div>
  );
}
