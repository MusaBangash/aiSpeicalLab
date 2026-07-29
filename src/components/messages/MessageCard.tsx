import { URGENCY_STYLE, URGENCY_LABEL } from "./urgency";
import type { InboxMessage } from "@/lib/messages";

export function MessageCard({ message }: { message: InboxMessage }) {
  return (
    <div className="card" style={{ padding: "var(--space-4)", ...URGENCY_STYLE[message.urgency] }}>
      <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--muted)", marginBottom: "var(--space-1)" }}>
        {URGENCY_LABEL[message.urgency]}
      </div>
      <div style={{ fontSize: "var(--text-md)", marginBottom: "var(--space-2)" }}>{message.body}</div>
      <div style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>
        {message.teacherName} ·{" "}
        {new Date(message.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}
