/** Teacher: attendance overview + manual override (excused/late) */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfDay, toDateParam, parseDateParam, getLabMonthAttendanceCells } from "@/lib/attendance";
import { PageHeader } from "@/components/shell/PageHeader";
import { AttendanceGridClient } from "@/components/attendance/AttendanceGridClient";
import { MonthHeatmapGrid } from "@/components/attendance/MonthHeatmapGrid";
import { AttendanceDateJump } from "@/components/attendance/AttendanceDateJump";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function TeacherAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const { date: dateParam } = await searchParams;
  const date = dateParam ? startOfDay(parseDateParam(dateParam)) : startOfDay(new Date());
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  const next = new Date(date);
  next.setDate(next.getDate() + 1);

  const year = date.getFullYear();
  const month = date.getMonth();
  const monthPrev = new Date(year, month - 1, 1);
  const monthNext = new Date(year, month + 1, 1);

  const [students, records, labCells] = await Promise.all([
    db.user.findMany({ where: { role: "STUDENT" }, orderBy: { name: "asc" } }),
    db.attendance.findMany({ where: { date } }),
    getLabMonthAttendanceCells(year, month),
  ]);
  const byStudent = new Map(records.map((r) => [r.studentId, r]));

  return (
    <div className="page-anim">
      <PageHeader title="Attendance" />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/teacher/attendance?date=${toDateParam(monthPrev)}`} className="btn ghost">
            ← Prev month
          </Link>
          <div style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>
            {MONTH_NAMES[month]} {year}
          </div>
          <Link href={`/teacher/attendance?date=${toDateParam(monthNext)}`} className="btn ghost">
            Next month →
          </Link>
        </div>
        <AttendanceDateJump initialDate={toDateParam(date)} />
      </div>

      <MonthHeatmapGrid year={year} month={month} cells={labCells} />
      <div className="legend">
        <span className="lg">
          <i style={{ background: "var(--gold)" }} />
          High turnout (90%+)
        </span>
        <span className="lg">
          <i style={{ background: "var(--gold-soft)", border: "1.5px solid var(--gold)" }} />
          Moderate (70-89%)
        </span>
        <span className="lg">
          <i style={{ background: "var(--coral-soft)" }} />
          Low (&lt;70%)
        </span>
        <span className="lg">
          <i style={{ background: "var(--gold-mist)" }} />
          Weekend / holiday
        </span>
      </div>

      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <Link href={`/teacher/attendance?date=${toDateParam(prev)}`} className="btn ghost">
            ← Prev day
          </Link>
          <div style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>
            {date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <Link href={`/teacher/attendance?date=${toDateParam(next)}`} className="btn ghost">
            Next day →
          </Link>
        </div>
        <AttendanceGridClient
          rows={students.map((student) => {
            const rec = byStudent.get(student.id);
            return {
              studentId: student.id,
              studentName: student.name,
              date: toDateParam(date),
              initialStatus: rec?.status ?? null,
              initialNote: rec?.note ?? null,
              initialSource: rec?.source ?? null,
              initialCheckedInAt: rec?.checkedInAt ? rec.checkedInAt.toISOString() : null,
            };
          })}
        />
      </div>
    </div>
  );
}
