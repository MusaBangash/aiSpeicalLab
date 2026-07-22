/** Student: assigned homework — checklists + submission */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAssignmentsForStudent } from "@/lib/homework";
import { PageHeader } from "@/components/shell/PageHeader";
import { AssignmentCard } from "@/components/homework/AssignmentCard";

export default async function StudentExercisesPage() {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const assignments = await getAssignmentsForStudent(session.user.id);

  return (
    <div className="page-anim">
      <PageHeader title="Homework" />
      {assignments.length === 0 ? (
        <div className="card" style={{ padding: 20 }}>
          No homework assigned yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {assignments.map((a) => (
            <AssignmentCard key={a.id} assignment={a} />
          ))}
        </div>
      )}
    </div>
  );
}
