import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudentRankStatus } from "@/lib/rank";
import { PageHeader } from "@/components/shell/PageHeader";
import { Certificate } from "@/components/certificates/Certificate";

export default async function StudentRankCertificatePage() {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const [rankStatus, user] = await Promise.all([
    getStudentRankStatus(session.user.id),
    db.user.findUnique({ where: { id: session.user.id }, include: { lab: true } }),
  ]);

  return (
    <div className="page-anim">
      <div className="no-print">
        <PageHeader title="Certificate" />
      </div>
      <Certificate
        labName={user?.lab?.name ?? null}
        studentName={session.user.name ?? ""}
        achievementTitle={`has achieved the rank of ${rankStatus.rank.currentRank}`}
        dateLabel="Issued on"
        date={new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
      />
    </div>
  );
}
