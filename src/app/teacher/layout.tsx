import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { AppShell, type NavItem } from "@/components/shell/AppShell";

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) return null; // middleware already redirects; defense in depth

  const t = getDictionary(session.user.language);
  const teacherNav: NavItem[] = [
    { href: "/teacher/console", label: t.nav.console, icon: "home" },
    { href: "/teacher/exams", label: t.nav.exams, icon: "award" },
    { href: "/teacher/attendance", label: t.nav.attendance, icon: "calendar" },
    { href: "/teacher/students", label: t.nav.students, icon: "list" },
  ];

  return (
    <AppShell role="Teacher" userName={session.user.name ?? ""} navItems={teacherNav}>
      {children}
    </AppShell>
  );
}
