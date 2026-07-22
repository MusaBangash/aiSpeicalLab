"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ConfirmSheet } from "@/components/exams/ConfirmSheet";
import { URGENCY_STYLE, URGENCY_LABEL } from "./urgency";
import type { SentMessage } from "@/lib/messages";

export function SentMessageRow({ message }: { message: SentMessage }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);

  async function retract() {
    setPending(true);
    await fetch(`/api/messages/${message.id}/retract`, { method: "POST" });
    setPending(false);
    setConfirming(false);
    router.refresh();
  }

  return (
    <Card style={{ padding: 16, marginBottom: 10, ...URGENCY_STYLE[message.urgency] }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>
          {URGENCY_LABEL[message.urgency]} · {message.targetLabel} · {message.recipientCount} recipient
          {message.recipientCount === 1 ? "" : "s"}
        </div>
        {message.retractedAt ? <Chip variant="locked">Retracted</Chip> : null}
      </div>
      <div style={{ fontSize: 14, marginBottom: 8 }}>{message.body}</div>
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: message.retractedAt ? 0 : 8 }}>
        {new Date(message.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
      </div>
      {!message.retractedAt ? (
        <button className="btn ghost" disabled={pending} onClick={() => setConfirming(true)}>
          Retract
        </button>
      ) : null}

      {confirming ? (
        <ConfirmSheet
          title="Retract this message?"
          message="This message will be hidden from students' inboxes. It is never removed and stays fully recoverable for audit."
          confirmLabel="Retract"
          confirmVariant="coral"
          pending={pending}
          onCancel={() => setConfirming(false)}
          onConfirm={retract}
        />
      ) : null}
    </Card>
  );
}
