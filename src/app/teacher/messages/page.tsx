/** Teacher: compose one-way announcements + view sent-message history */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getClassesForTeacher } from "@/lib/classes";
import { getSentMessagesForTeacher, getAllStudentsForPicker } from "@/lib/messages";
import { PageHeader } from "@/components/shell/PageHeader";
import { ComposeMessageForm } from "@/components/messages/ComposeMessageForm";
import { SentMessageRow } from "@/components/messages/SentMessageRow";

export default async function TeacherMessagesPage() {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const [classes, students, sent] = await Promise.all([
    getClassesForTeacher(session.user.id),
    getAllStudentsForPicker(),
    getSentMessagesForTeacher(session.user.id),
  ]);

  return (
    <div className="page-anim">
      <PageHeader title="Messages" />
      <ComposeMessageForm classes={classes} students={students} />
      <div style={{ marginTop: 24 }}>
        {sent.length === 0 ? (
          <div className="card" style={{ padding: 20 }}>
            No messages sent yet.
          </div>
        ) : (
          sent.map((m) => <SentMessageRow key={m.id} message={m} />)
        )}
      </div>
    </div>
  );
}
