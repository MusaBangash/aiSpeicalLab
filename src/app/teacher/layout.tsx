import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { getUnansweredCount } from "@/lib/doubts";
import { AppShell, type NavGroup } from "@/components/shell/AppShell";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) return null; // middleware already redirects; defense in depth

  const t = getDictionary(session.user.language);
  const unansweredCount = await getUnansweredCount();
  const teacherNav: NavGroup[] = [
    { items: [{ href: "/teacher/console", label: t.nav.console, icon: "home" }] },
    {
      label: "People",
      items: [
        { href: "/teacher/students", label: t.nav.students, icon: "list" },
        { href: "/teacher/classes", label: t.nav.classes, icon: "people" },
        { href: "/teacher/attendance", label: t.nav.attendance, icon: "calendar" },
      ],
    },
    {
      label: "Coursework",
      items: [
        { href: "/teacher/exams", label: t.nav.exams, icon: "award" },
        { href: "/teacher/homework", label: t.nav.homework, icon: "upload" },
      ],
    },
    {
      label: "Inbox",
      items: [
        { href: "/teacher/messages", label: t.nav.messages, icon: "megaphone" },
        { href: "/teacher/doubts", label: t.nav.questions, icon: "question", badge: unansweredCount || undefined },
      ],
    },
  ];

  return (
    <AppShell role="Teacher" userName={session.user.name ?? ""} navGroups={teacherNav}>
      {children}
    </AppShell>
  );
}
