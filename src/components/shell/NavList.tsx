"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./Icon";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  badge?: number;
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

export function NavList({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <>
      {groups.map((group, i) => (
        <div className="nav-group" key={group.label ?? i}>
          {group.label ? <div className="nav-group-label">{group.label}</div> : null}
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} className={"nav-item" + (active ? " active" : "")}>
                <span className="ic">
                  <Icon name={item.icon} size={20} />
                </span>
                {item.label}
                {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}
