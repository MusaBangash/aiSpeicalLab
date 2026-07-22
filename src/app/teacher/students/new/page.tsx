/** Teacher: enroll a new student — full profile, optional photo, optional class */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getClassesForTeacher } from "@/lib/classes";
import { PageHeader } from "@/components/shell/PageHeader";
import { EnrollStudentForm } from "@/components/students/EnrollStudentForm";

export default async function NewStudentPage() {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const classes = await getClassesForTeacher(session.user.id);

  return (
    <div className="page-anim">
      <PageHeader title="Add student" />
      <EnrollStudentForm classes={classes} />
    </div>
  );
}
