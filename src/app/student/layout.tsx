import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getUnseenNotificationCount } from "@/lib/notifications";
import { AppShell, type NavGroup } from "@/components/shell/AppShell";
import { AttendanceToast } from "@/components/attendance/AttendanceToast";
import { UnreadMessagesToast } from "@/components/messages/UnreadMessagesToast";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) return null; // middleware already redirects; defense in depth

  const t = getDictionary(session.user.language);
  const unseenCount = await getUnseenNotificationCount(session.user.id);
  const studentNav: NavGroup[] = [
    { items: [{ href: "/student/dashboard", label: t.nav.dashboard, icon: "home" }] },
    {
      label: "Learning",
      items: [
        { href: "/student/curriculum", label: t.nav.curriculum, icon: "book" },
        { href: "/student/exercises", label: t.nav.exercises, icon: "pencil" },
        { href: "/student/exams", label: t.nav.exams, icon: "award" },
      ],
    },
    {
      label: "Updates",
      items: [
        { href: "/student/notifications", label: t.nav.notifications, icon: "bell", badge: unseenCount || undefined },
        { href: "/student/messages", label: t.nav.messages, icon: "megaphone" },
        { href: "/student/doubts", label: t.nav.questions, icon: "question" },
      ],
    },
    {
      label: "Me",
      items: [
        { href: "/student/attendance", label: t.nav.attendance, icon: "calendar" },
        { href: "/student/progress", label: t.nav.progress, icon: "chart" },
        { href: "/student/settings", label: t.nav.settings, icon: "gear" },
      ],
    },
  ];

  return (
    <>
      <div className="toast-stack">
        <AttendanceToast />
        <UnreadMessagesToast />
      </div>
      <AppShell role="Student" userName={session.user.name ?? ""} navGroups={studentNav}>
        {children}
      </AppShell>
    </>
  );
}
