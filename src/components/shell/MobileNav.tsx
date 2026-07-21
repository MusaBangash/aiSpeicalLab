"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";

/**
 * Wraps the sidebar for small screens. A pure-CSS checkbox toggle won't
 * reset on client-side navigation (this layout persists across route
 * changes), which would leave the drawer open after tapping a nav link —
 * so this owns real state instead, closed automatically on every route
 * change.
 */
export function MobileNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const asideRef = useRef<HTMLElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    // Move focus into the drawer once it's open.
    const firstLink = asideRef.current?.querySelector<HTMLElement>("a, button");
    firstLink?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        hamburgerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={hamburgerRef}
        type="button"
        className="hamburger-btn no-print"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <Icon name={open ? "close" : "menu"} size={20} />
      </button>
      {open ? <div className="nav-scrim" onClick={() => setOpen(false)} /> : null}
      <aside ref={asideRef} className={"side" + (open ? " open" : "")}>
        {children}
      </aside>
    </>
  );
}
