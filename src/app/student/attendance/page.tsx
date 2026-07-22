/** Attendance (month heatmap, streak, hours) */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfDay, computeStreak, getTermAttendancePercent, getStudentMonthAttendanceCells } from "@/lib/attendance";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";
import { MonthHeatmapGrid } from "@/components/attendance/MonthHeatmapGrid";

export default async function StudentAttendancePage() {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const now = new Date();
  const today = startOfDay(now);
  // Every day bucket below goes through startOfDay so it lines up with how
  // Attendance.date is actually stored — see the comment on startOfDay.
  const monthStart = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));

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

  const cells = await getStudentMonthAttendanceCells(session.user.id, now.getFullYear(), now.getMonth(), now);

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
        <div>
          <MonthHeatmapGrid year={now.getFullYear()} month={now.getMonth()} cells={cells} />
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
        </div>
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
