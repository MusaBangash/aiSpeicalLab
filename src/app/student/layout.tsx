import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { getDictionary } from "@/lib/i18n";
import { AppShell, type NavItem } from "@/components/shell/AppShell";
import { AttendanceToast } from "@/components/attendance/AttendanceToast";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) return null; // middleware already redirects; defense in depth

  const t = getDictionary(session.user.language);
  const studentNav: NavItem[] = [
    { href: "/student/dashboard", label: t.nav.dashboard, icon: "home" },
    { href: "/student/curriculum", label: t.nav.curriculum, icon: "book" },
    { href: "/student/exercises", label: t.nav.exercises, icon: "pencil" },
    { href: "/student/exams", label: t.nav.exams, icon: "award" },
    { href: "/student/attendance", label: t.nav.attendance, icon: "calendar" },
    { href: "/student/progress", label: t.nav.progress, icon: "chart" },
    { href: "/student/settings", label: t.nav.settings, icon: "gear" },
  ];

  return (
    <>
      <AttendanceToast />
      <AppShell role="Student" userName={session.user.name ?? ""} navItems={studentNav}>
        {children}
      </AppShell>
    </>
  );
}
