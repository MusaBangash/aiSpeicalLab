/** Teacher: Q&A inbox — any teacher can see and answer any student's question. */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getInboxForTeacher } from "@/lib/doubts";
import { PageHeader } from "@/components/shell/PageHeader";
import { DoubtInboxList } from "@/components/doubts/DoubtInboxList";

export default async function TeacherDoubtsPage() {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const doubts = await getInboxForTeacher();

  return (
    <div className="page-anim">
      <PageHeader title="Questions" />
      <DoubtInboxList doubts={doubts} />
    </div>
  );
}
