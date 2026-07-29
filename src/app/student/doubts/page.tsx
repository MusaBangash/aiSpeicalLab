/** Student: ask a question tagged to a curriculum module, and see the history/answers. */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDoubtsForStudent } from "@/lib/doubts";
import { PageHeader } from "@/components/shell/PageHeader";
import { AskDoubtForm } from "@/components/doubts/AskDoubtForm";
import { DoubtHistoryCard } from "@/components/doubts/DoubtHistoryCard";

export default async function StudentDoubtsPage() {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const [modules, doubts] = await Promise.all([
    db.curriculumModule.findMany({ orderBy: { order: "asc" } }),
    getDoubtsForStudent(session.user.id),
  ]);

  return (
    <div className="page-anim">
      <PageHeader title="Questions" />
      <AskDoubtForm modules={modules.map((m) => ({ id: m.id, title: m.title }))} />

      {doubts.length === 0 ? (
        <div className="card" style={{ padding: "var(--space-5)" }}>
          No questions asked yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {doubts.map((d) => (
            <DoubtHistoryCard key={d.id} doubt={d} />
          ))}
        </div>
      )}
    </div>
  );
}
