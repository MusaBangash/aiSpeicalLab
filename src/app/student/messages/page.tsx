/** Student: inbox of one-way teacher announcements */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getInboxForStudent, markInboxRead } from "@/lib/messages";
import { PageHeader } from "@/components/shell/PageHeader";
import { MessageCard } from "@/components/messages/MessageCard";

export default async function StudentMessagesPage() {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const inbox = await getInboxForStudent(session.user.id);
  await markInboxRead(session.user.id); // viewing the inbox marks it read for next load

  return (
    <div className="page-anim">
      <PageHeader title="Messages" />
      {inbox.length === 0 ? (
        <div className="card" style={{ padding: 20 }}>
          No messages yet.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {inbox.map((m) => (
            <MessageCard key={m.id} message={m} />
          ))}
        </div>
      )}
    </div>
  );
}
