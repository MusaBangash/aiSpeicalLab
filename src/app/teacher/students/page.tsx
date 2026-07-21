/** Teacher: all students, exam avg + attendance %, links to each profile */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAllStudentsSummary } from "@/lib/metrics";
import { PageHeader } from "@/components/shell/PageHeader";
import { StudentsGridClient } from "@/components/students/StudentsGridClient";

export default async function TeacherStudentsPage() {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const students = await getAllStudentsSummary();

  return (
    <div className="page-anim">
      <PageHeader title="Students" />
      <StudentsGridClient students={students} />
    </div>
  );
}
