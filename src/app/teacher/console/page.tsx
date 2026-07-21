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
import { getTeacherConsole } from "@/lib/dashboard";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";

export default async function TeacherConsolePage() {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const data = await getTeacherConsole(startOfDay(new Date()));

  return (
    <div className="page-anim">
      <PageHeader title="Console" />
      <div className="hero-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <Card className="mini-card">
          <div className="mini-top">
            <div className="mini-icon g">
              <Icon name="check" size={20} />
            </div>
          </div>
          <div className="mini-num">
            {data.presentToday} / {data.studentCount}
          </div>
          <div className="mini-label">Present today</div>
        </Card>
        <Card className="mini-card">
          <div className="mini-top">
            <div className="mini-icon l">
              <Icon name="award" size={20} />
            </div>
          </div>
          <div className="mini-num">{data.examStats.length}</div>
          <div className="mini-label">Published exams</div>
        </Card>
      </div>

      <Card className="feed-card" style={{ marginBottom: 16 }}>
        <div className="feed-title">Exam pass rates</div>
        {data.examStats.length === 0 ? (
          <div className="feed-empty">No published exams yet.</div>
        ) : (
          data.examStats.map((stat, i) => (
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
          ))
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
