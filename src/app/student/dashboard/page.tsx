/** Student dashboard (progress ring, streak, continue card) */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStudentDashboard } from "@/lib/dashboard";
import { checkAndAwardLoginBadges } from "@/lib/badges";
import { getTodayCheckIn } from "@/lib/wellbeing";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";
import { ProgressRing } from "@/components/dashboard/ProgressRing";
import { CheckInWidget } from "@/components/wellbeing/CheckInWidget";

export default async function StudentDashboardPage() {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  try {
    await checkAndAwardLoginBadges(session.user.id);
  } catch (err) {
    console.error("badge award failed on dashboard load", err);
    // deliberately swallowed — a badge-award bug must never block the dashboard
  }

  const [data, todayCheckIn] = await Promise.all([
    getStudentDashboard(session.user.id),
    getTodayCheckIn(session.user.id),
  ]);

  return (
    <div className="page-anim">
      <PageHeader title="Dashboard" />
      <CheckInWidget initialMood={todayCheckIn?.mood ?? null} initialNote={todayCheckIn?.note ?? null} />
      <div className="hero-grid">
        <Card className="ring-card">
          <ProgressRing percent={data.progressPercent} />
          <div className="ring-txt">
            <h3>Welcome back, {session.user.name?.split(" ")[0]}</h3>
            <p>
              {data.continueModule
                ? `You're ${data.progressPercent}% through your path. Continue with ${data.continueModule.title}.`
                : `You're ${data.progressPercent}% through your path.`}
            </p>
          </div>
        </Card>
        <Card className="mini-card">
          <div className="mini-top">
            <div className="mini-icon g">
              <Icon name="flame" size={20} />
            </div>
          </div>
          <div className="mini-num">{data.streak}</div>
          <div className="mini-label">Day attendance streak</div>
        </Card>
        <Card className="mini-card">
          <div className="mini-top">
            <div className="mini-icon l">
              <Icon name="trophy" size={20} />
            </div>
          </div>
          <div className="mini-num">{data.avgScorePercent}%</div>
          <div className="mini-label">Average exam score</div>
        </Card>
      </div>

      <div className="duo">
        <Card className="continue-card">
          <div className="cc-inner">
            <span className="cc-tag">
              <Icon name="play" size={13} />
              Continue learning
            </span>
            <div className="cc-title">{data.continueModule ? data.continueModule.title : "Curriculum"}</div>
            <div className="cc-sub">
              {data.continueModule ? "Pick up where you left off." : "No module in progress right now."}
            </div>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${data.progressPercent}%` }} />
            </div>
            <Link href="/student/curriculum" className="btn">
              <Icon name="play" size={15} />
              Resume module
            </Link>
          </div>
        </Card>
        <Card className="feed-card">
          <div className="feed-title">Recent activity</div>
          {data.feed.length === 0 ? (
            <div className="feed-empty">No exam activity yet.</div>
          ) : (
            data.feed.map((item, i) => (
              <div key={i} className="feed-item">
                <div className={"feed-dot " + (item.passed ? "l" : "g")}>
                  <Icon name={item.passed ? "check" : "star"} size={16} />
                </div>
                <div>
                  <div className="feed-t">{item.text}</div>
                  <div className="feed-s">{item.sub}</div>
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
