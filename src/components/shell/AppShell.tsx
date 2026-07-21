import type { ReactNode } from "react";
import { NavList, type NavItem } from "./NavList";
import { PineLogo } from "./PineLogo";
import { SignOutForm } from "./SignOutForm";
import { MobileNav } from "./MobileNav";
import { initials } from "@/lib/initials";

export type { NavItem };

export function AppShell({
  role,
  userName,
  navItems,
  children,
}: {
  role: "Student" | "Teacher";
  userName: string;
  navItems: NavItem[];
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

        <div className="nav-label">Menu</div>
        <NavList items={navItems} />

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
