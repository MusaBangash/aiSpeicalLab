/** Teacher: one class's roster + enroll/remove students */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getClassRoster, getEnrollableStudents } from "@/lib/classes";
import { getClassActivity, toClassActivityPayload } from "@/lib/activity";
import { getClassAttendanceRows, toDateParam } from "@/lib/attendance";
import { PageHeader } from "@/components/shell/PageHeader";
import { ClassRosterClient } from "@/components/classes/ClassRosterClient";
import { ClassScheduleForm } from "@/components/classes/ClassScheduleForm";
import { ClassLivePanel } from "@/components/classes/ClassLivePanel";
import { ClassAttendanceSection } from "@/components/classes/ClassAttendanceSection";

export default async function TeacherClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const { classId } = await params;
  const cls = await db.class.findUnique({ where: { id: classId } });
  if (!cls || cls.teacherId !== session.user.id) redirect("/teacher/classes");

  const [roster, enrollable] = await Promise.all([getClassRoster(classId), getEnrollableStudents(classId)]);
  const today = new Date();
  const [activity, attendanceRows] = await Promise.all([
    getClassActivity(roster.map((r) => r.studentId)),
    getClassAttendanceRows(classId, today),
  ]);

  return (
    <div className="page-anim">
      <PageHeader title={cls.name} />
      <ClassScheduleForm classId={classId} scheduledStartMinutes={cls.scheduledStartMinutes} />
      <h2>Live activity</h2>
      <ClassLivePanel classId={classId} initialStudents={toClassActivityPayload(roster, activity)} />
      <h2>Attendance — today</h2>
      <ClassAttendanceSection classId={classId} date={toDateParam(today)} rows={attendanceRows} />
      <ClassRosterClient classId={classId} roster={roster} enrollable={enrollable} />
    </div>
  );
}
