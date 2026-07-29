/**
 * Teacher console (class overview) — kept minimal on purpose: a live
 * class view is explicitly v2 (docs/04-roadmap.md). This just surfaces
 * today's attendance and exam pass-rate summaries plus quick links.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfDay } from "@/lib/attendance";
import { getTeacherConsole, getMostImprovedStudents } from "@/lib/dashboard";
import { getAtRiskStudents } from "@/lib/atrisk";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";
import { AtRiskStudentsCard } from "@/components/students/AtRiskStudentsCard";
import { MostImprovedCard } from "@/components/students/MostImprovedCard";
import { ProgressRing } from "@/components/dashboard/ProgressRing";

const EXAM_STATS_SHOWN = 5;

export default async function TeacherConsolePage() {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const today = startOfDay(new Date());
  const [data, atRiskStudents, mostImproved] = await Promise.all([
    getTeacherConsole(today),
    getAtRiskStudents(today),
    getMostImprovedStudents(today),
  ]);

  const hour = today.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const firstName = session.user.name?.split(" ")[0];

  const presentPercent = data.studentCount > 0 ? Math.round((data.presentToday / data.studentCount) * 100) : 0;
  const totalAttempted = data.examStats.reduce((sum, s) => sum + s.attempted, 0);
  const totalPassed = data.examStats.reduce((sum, s) => sum + s.passed, 0);
  const passRatePercent = totalAttempted > 0 ? Math.round((totalPassed / totalAttempted) * 100) : 0;

  return (
    <div className="page-anim">
      <PageHeader title="Console" />
      <div className="console-greeting">
        <div className="console-greeting-text">
          {greeting}{firstName ? `, ${firstName}` : ""}
          <span className="console-greeting-sub">
            {data.presentToday} of {data.studentCount} students present today
            {atRiskStudents.length > 0
              ? ` · ${atRiskStudents.length} flagged at-risk`
              : ""}
          </span>
        </div>
      </div>
      <AtRiskStudentsCard students={atRiskStudents} viewAllHref="/teacher/students?risk=1" />
      <MostImprovedCard students={mostImproved} />
      <div className="hero-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card className="ring-card">
          <ProgressRing
            percent={presentPercent}
            label="Present today"
            color="var(--leaf-mid)"
            trackColor="var(--leaf-soft)"
            size={100}
          />
          <div className="ring-txt">
            <h3>
              {data.presentToday} of {data.studentCount} present
            </h3>
            <p>Attendance marked so far today.</p>
          </div>
        </Card>
        <Card className="ring-card">
          <ProgressRing percent={passRatePercent} label="Pass rate" color="var(--gold)" trackColor="var(--gold-soft)" size={100} />
          <div className="ring-txt">
            <h3>
              {totalPassed} of {totalAttempted} passed
            </h3>
            <p>Across {data.examStats.length} published exam{data.examStats.length === 1 ? "" : "s"}.</p>
          </div>
        </Card>
      </div>

      {/* Profiled students only — students enrolled before this feature existed have no StudentProfile row, so these counts can be lower than studentCount above. Kept as a quiet reference strip, not full-size stat cards — this isn't something acted on day-to-day. */}
      <div className="console-meta-strip">
        <span>
          <b>{data.girlsCount}</b> girls
        </span>
        <span>
          <b>{data.boysCount}</b> boys
        </span>
        <span>
          <b>{data.hostelizedCount}</b> hostelized
        </span>
        <span>
          <b>{data.dayScholarCount}</b> day scholar
        </span>
      </div>

      <Card className="feed-card" style={{ marginBottom: "var(--space-6)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="feed-title" style={{ marginBottom: 0 }}>
            Exam pass rates
          </div>
          {data.examStats.length > EXAM_STATS_SHOWN ? (
            <Link href="/teacher/exams" style={{ fontSize: 13 }}>
              View all {data.examStats.length}
            </Link>
          ) : null}
        </div>
        {data.examStats.length === 0 ? (
          <div className="feed-empty">No published exams yet.</div>
        ) : (
          <div style={{ marginTop: "var(--space-3)" }}>
            {data.examStats.slice(0, EXAM_STATS_SHOWN).map((stat, i) => (
              <div key={i} className="feed-item">
                <div className="feed-dot l">
                  <Icon name="trophy" size={16} />
                </div>
                <div>
                  <div className="feed-t">{stat.title}</div>
                  <div className="feed-s">
                    {stat.passed} / {stat.attempted} passed
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div style={{ display: "flex", gap: 12 }}>
        <Link href="/teacher/exams" className="btn">
          Manage exams
        </Link>
        <Link href="/teacher/attendance" className="btn ghost">
          Attendance
        </Link>
      </div>
    </div>
  );
}
