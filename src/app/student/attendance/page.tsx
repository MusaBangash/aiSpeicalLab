/** Attendance (month heatmap, streak, hours) */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfDay, computeStreak, mondayIndex, getTermAttendancePercent } from "@/lib/attendance";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function StudentAttendancePage() {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const now = new Date();
  const today = startOfDay(now);
  // Every day bucket below goes through startOfDay so it lines up with how
  // Attendance.date is actually stored — see the comment on startOfDay.
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const [monthRecords, allRecords, sessions] = await Promise.all([
    db.attendance.findMany({
      where: { studentId: session.user.id, date: { gte: monthStart } },
    }),
    // A wider window covers streaks that started before this month.
    db.attendance.findMany({
      where: { studentId: session.user.id, date: { gte: startOfDay(new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)) } },
    }),
    db.session.findMany({ where: { studentId: session.user.id } }),
  ]);

  // Records came from the DB, so their `date` is already a startOfDay bucket — key on it directly.
  const byDay = new Map(monthRecords.map((r) => [new Date(r.date).getTime(), r]));
  const todayRecord = byDay.get(today.getTime());
  const streak = computeStreak(allRecords, today);

  const termPercent = await getTermAttendancePercent(session.user.id, now);

  const totalMs = sessions.reduce((sum, s) => sum + ((s.endedAt ?? now).getTime() - s.startedAt.getTime()), 0);
  const totalHours = Math.round(totalMs / (1000 * 60 * 60));

  const startPad = mondayIndex(monthStart);
  const cells: { day: number; cls: string }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = startOfDay(new Date(now.getFullYear(), now.getMonth(), d));
    let cls = "hcell";
    if (date > today) {
      cls += " future";
    } else {
      const rec = byDay.get(date.getTime());
      if (rec?.status === "PRESENT") cls += " p";
      else if (rec?.status === "LATE") cls += " late";
      else if (rec?.status === "ABSENT") cls += " a";
      else if (rec?.status === "EXCUSED") cls += " excused";
    }
    cells.push({ day: d, cls });
  }

  return (
    <div className="page-anim">
      <PageHeader title="Attendance" />
      {todayRecord?.checkedInAt && (
        <div className="att-checkin-note">
          Checked in today at{" "}
          {todayRecord.checkedInAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
      <div className="att-duo">
        <Card className="heat-card">
          <div className="rc-title">
            {MONTH_NAMES[now.getMonth()]} {now.getFullYear()}
          </div>
          <div className="heat-grid">
            {DAY_LABELS.map((l, i) => (
              <div key={i} className="heat-day">
                {l}
              </div>
            ))}
            {Array.from({ length: startPad }, (_, i) => (
              <div key={"pad" + i} />
            ))}
            {cells.map((c) => (
              <div key={c.day} className={c.cls}>
                {c.day}
              </div>
            ))}
          </div>
          <div className="legend">
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
        </Card>
        <div>
          <Card className="mini-card" style={{ marginBottom: 16 }}>
            <div className="mini-top">
              <div className="mini-icon g">
                <Icon name="check" size={18} />
              </div>
            </div>
            <div className="mini-num">{termPercent}%</div>
            <div className="mini-label">Attendance this term</div>
          </Card>
          <Card className="mini-card" style={{ marginBottom: 16 }}>
            <div className="mini-top">
              <div className="mini-icon l">
                <Icon name="clock" size={18} />
              </div>
            </div>
            <div className="mini-num">{totalHours}h</div>
            <div className="mini-label">Total lab hours logged</div>
          </Card>
          <Card className="mini-card">
            <div className="mini-top">
              <div className="mini-icon g">
                <Icon name="flame" size={18} />
              </div>
            </div>
            <div className="mini-num">{streak}</div>
            <div className="mini-label">Day attendance streak</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
