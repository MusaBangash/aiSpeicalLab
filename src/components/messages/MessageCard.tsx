import { URGENCY_STYLE, URGENCY_LABEL } from "./urgency";
import type { InboxMessage } from "@/lib/messages";

export function MessageCard({ message }: { message: InboxMessage }) {
  return (
    <div className="card" style={{ padding: 16, ...URGENCY_STYLE[message.urgency] }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 4 }}>
        {URGENCY_LABEL[message.urgency]}
      </div>
      <div style={{ fontSize: 14, marginBottom: 8 }}>{message.body}</div>
      <div style={{ fontSize: 12, color: "var(--muted)" }}>
        {message.teacherName} ·{" "}
        {new Date(message.createdAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
      </div>
    </div>
  );
}
