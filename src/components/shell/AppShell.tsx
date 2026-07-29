import type { ReactNode } from "react";
import { NavList, type NavItem, type NavGroup } from "./NavList";
import { PineLogo } from "./PineLogo";
import { SignOutForm } from "./SignOutForm";
import { MobileNav } from "./MobileNav";
import { initials } from "@/lib/initials";

export type { NavItem, NavGroup };

export function AppShell({
  role,
  userName,
  navGroups,
  children,
}: {
  role: "Student" | "Teacher";
  userName: string;
  navGroups: NavGroup[];
  children: ReactNode;
}) {
  return (
    <div className="shell">
      <MobileNav>
        <div className="logo">
          <PineLogo className="logo-mark" />
          <div>
            <div className="logo-name">
              Anan<em>as</em>
            </div>
            <div className="logo-sub">AI Lab System</div>
          </div>
        </div>

        <NavList groups={navGroups} />

        <div className="side-foot">
          <div className="me-avatar">{initials(userName)}</div>
          <div>
            <div className="me-name">{userName}</div>
            <div className="me-role">{role}</div>
          </div>
          <SignOutForm />
        </div>
      </MobileNav>

      <main className="content">{children}</main>
    </div>
  );
}
