/** Teacher: create exam (title, module, timer, cooldown, pass mark, questions shown) */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shell/PageHeader";
import { CreateExamForm } from "@/components/exams/CreateExamForm";

export default async function NewExamPage() {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const modules = await db.curriculumModule.findMany({ orderBy: { order: "asc" } });

  return (
    <div className="page-anim">
      <PageHeader title="New exam" />
      <CreateExamForm modules={modules} />
    </div>
  );
}
