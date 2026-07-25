"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmSheet } from "@/components/exams/ConfirmSheet";

type ConfirmTarget = "project" | "nomination" | null;

export function BadgeAwardActions({
  studentId,
  projectCompleteEarnedAt,
  nominationEarnedAt,
  nominationEligible,
}: {
  studentId: string;
  projectCompleteEarnedAt: Date | null;
  nominationEarnedAt: Date | null;
  nominationEligible: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<ConfirmTarget>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmAward() {
    if (!confirming) return;
    setPending(true);
    setError(null);
    const path = confirming === "project" ? "project-complete" : "master-engineer-nomination";
    const res = await fetch(`/api/students/${studentId}/badges/${path}`, { method: "POST" });
    setPending(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not award the badge");
      return;
    }
    setConfirming(null);
    router.refresh();
  }

  return (
    <div className="rank-actions">
      {error ? <div className="field-error">{error}</div> : null}

      {projectCompleteEarnedAt ? (
        <span className="rank-sub">
          Project Complete awarded {projectCompleteEarnedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      ) : (
        <button type="button" className="btn leaf" onClick={() => setConfirming("project")}>
          Award Project Complete
        </button>
      )}

      {nominationEarnedAt ? (
        <span className="rank-sub">
          Nominated for Master Engineer {nominationEarnedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      ) : (
        <div>
          <button
            type="button"
            className="btn leaf"
            disabled={!nominationEligible}
            onClick={() => setConfirming("nomination")}
          >
            Nominate for Master Engineer
          </button>
          {!nominationEligible ? (
            <div className="rank-sub">Not yet eligible — requires 24 months tenure and 400 points.</div>
          ) : null}
        </div>
      )}

      {confirming ? (
        <ConfirmSheet
          title={confirming === "project" ? "Award Project Complete?" : "Nominate for Master Engineer?"}
          message={
            confirming === "project"
              ? "This awards the Project Complete badge to this student. Each badge can only be awarded once."
              : "This nominates this student for the top rank, Master Engineer. Each student can only be nominated once."
          }
          confirmLabel={confirming === "project" ? "Award" : "Nominate"}
          confirmVariant="leaf"
          pending={pending}
          onCancel={() => setConfirming(null)}
          onConfirm={confirmAward}
        />
      ) : null}
    </div>
  );
}
