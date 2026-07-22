/** Teacher: one assignment's roster, checklist/submission status, and grading */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAssignmentDetail } from "@/lib/homework";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { AssignmentRosterTable } from "@/components/homework/AssignmentRosterTable";

export default async function TeacherHomeworkDetailPage({
  params,
}: {
  params: Promise<{ exerciseId: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const { exerciseId } = await params;
  const detail = await getAssignmentDetail(exerciseId);
  if (!detail.ok) redirect("/teacher/homework");

  return (
    <div className="page-anim">
      <PageHeader title={detail.exercise.title} />
      <Card style={{ padding: 20, marginBottom: 16 }}>
        {detail.exercise.description ? <div style={{ marginBottom: 8 }}>{detail.exercise.description}</div> : null}
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          {detail.exercise.targetLabel} ·{" "}
          {detail.exercise.dueDate
            ? `Due ${detail.exercise.dueDate.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
            : "No due date"}
        </div>
      </Card>

      <AssignmentRosterTable
        items={detail.items}
        rows={detail.rows}
        canGrade={detail.exercise.teacherId === session.user.id}
      />
    </div>
  );
}
