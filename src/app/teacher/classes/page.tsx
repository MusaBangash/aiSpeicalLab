/** Teacher: list of this teacher's classes, with a create-class form */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getClassesForTeacher } from "@/lib/classes";
import { PageHeader } from "@/components/shell/PageHeader";
import { ClassesGridClient } from "@/components/classes/ClassesGridClient";

export default async function TeacherClassesPage() {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const classes = await getClassesForTeacher(session.user.id);

  return (
    <div className="page-anim">
      <PageHeader title="Classes" />
      <ClassesGridClient classes={classes} />
    </div>
  );
}
