/** Student: unified notification feed — messages, answered doubts, earned badges */
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getNotificationsForStudent, markAllNotificationsSeen } from "@/lib/notifications";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";

export default async function StudentNotificationsPage() {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const notifications = await getNotificationsForStudent(session.user.id);
  await markAllNotificationsSeen(session.user.id); // viewing this page marks everything seen for next load

  return (
    <div className="page-anim">
      <PageHeader title="Notifications" />
      <Card className="feed-card">
        {notifications.length === 0 ? (
          <div className="feed-empty">No notifications yet.</div>
        ) : (
          notifications.map((n) => (
            <Link key={`${n.type}-${n.id}`} href={n.href} className="feed-item" style={{ textDecoration: "none", color: "inherit" }}>
              <div className="feed-dot g">
                <Icon name={n.icon} size={16} />
              </div>
              <div>
                <div className="feed-t">{n.summary}</div>
                <div className="feed-s">
                  {n.occurredAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{" "}
                  {n.occurredAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </Link>
          ))
        )}
      </Card>
    </div>
  );
}
