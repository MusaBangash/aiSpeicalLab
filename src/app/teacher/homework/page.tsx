/** Teacher: list of created homework assignments + entry point to create a new one */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAssignmentsForTeacher } from "@/lib/homework";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";

export default async function TeacherHomeworkPage() {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const assignments = await getAssignmentsForTeacher(session.user.id);

  return (
    <div className="page-anim">
      <PageHeader title="Homework" />
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <Link href="/teacher/homework/new" className="btn">
          New assignment
        </Link>
      </div>

      {assignments.length === 0 ? (
        <Card style={{ padding: 20 }}>No assignments created yet.</Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {assignments.map((a) => (
            <Link key={a.id} href={`/teacher/homework/${a.id}`} style={{ textDecoration: "none", color: "inherit" }}>
              <Card style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{a.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
                    {a.dueDate ? `Due ${a.dueDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : "No due date"}
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 4 }}>
                  {a.targetLabel} · {a.itemCount} item{a.itemCount === 1 ? "" : "s"} · {a.submittedCount}/{a.rosterCount} submitted ·{" "}
                  {a.gradedCount}/{a.rosterCount} graded
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
