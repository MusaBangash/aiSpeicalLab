/** Teacher: bulk-enroll many students at once from a CSV upload. */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getClassesForTeacher } from "@/lib/classes";
import { PageHeader } from "@/components/shell/PageHeader";
import { BulkImportStudentsForm } from "@/components/students/BulkImportStudentsForm";

export default async function BulkImportStudentsPage() {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const classes = await getClassesForTeacher(session.user.id);

  return (
    <div className="page-anim">
      <PageHeader title="Bulk import students" />
      <BulkImportStudentsForm classes={classes} />
    </div>
  );
}
