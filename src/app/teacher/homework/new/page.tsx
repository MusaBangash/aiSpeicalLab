/** Teacher: create a new homework assignment */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getClassesForTeacher } from "@/lib/classes";
import { getAllStudentsForPicker } from "@/lib/messages";
import { PageHeader } from "@/components/shell/PageHeader";
import { CreateAssignmentForm } from "@/components/homework/CreateAssignmentForm";

export default async function NewHomeworkPage() {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const [classes, students] = await Promise.all([getClassesForTeacher(session.user.id), getAllStudentsForPicker()]);

  return (
    <div className="page-anim">
      <PageHeader title="New assignment" />
      <CreateAssignmentForm classes={classes} students={students} />
    </div>
  );
}
