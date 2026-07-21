/** Teacher: edit an exam's settings (title, module, timer, cooldown, pass mark, questions shown) */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shell/PageHeader";
import { EditExamForm } from "@/components/exams/EditExamForm";

export default async function EditExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const { examId } = await params;
  const [exam, modules] = await Promise.all([
    db.exam.findUnique({ where: { id: examId } }),
    db.curriculumModule.findMany({ orderBy: { order: "asc" } }),
  ]);
  if (!exam) redirect("/teacher/exams");

  return (
    <div className="page-anim">
      <PageHeader title={`Edit — ${exam.title}`} />
      <EditExamForm exam={exam} modules={modules} />
    </div>
  );
}
