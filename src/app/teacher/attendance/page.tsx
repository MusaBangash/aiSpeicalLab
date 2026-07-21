/** Teacher: attendance overview + manual override (excused/late) */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfDay, toDateParam, parseDateParam } from "@/lib/attendance";
import { PageHeader } from "@/components/shell/PageHeader";
import { AttendanceGridClient } from "@/components/attendance/AttendanceGridClient";

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

  const [students, records] = await Promise.all([
    db.user.findMany({ where: { role: "STUDENT" }, orderBy: { name: "asc" } }),
    db.attendance.findMany({ where: { date } }),
  ]);
  const byStudent = new Map(records.map((r) => [r.studentId, r]));

  return (
    <div className="page-anim">
      <PageHeader title="Attendance" />
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
  );
}
