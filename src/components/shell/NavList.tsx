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

export function NavList({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
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
    </>
  );
}
