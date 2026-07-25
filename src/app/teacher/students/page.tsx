/** Teacher: all students, exam avg + attendance %, links to each profile */
import Link from "next/link";
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
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 16 }}>
        <Link href="/teacher/students/bulk-import" className="btn ghost">
          Bulk import (CSV)
        </Link>
        <Link href="/teacher/students/new" className="btn">
          Add student
        </Link>
      </div>
      <StudentsGridClient students={students} />
    </div>
  );
}
