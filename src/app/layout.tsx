/**
 * Root layout — loads the Ananas theme fonts (Outfit + JetBrains Mono)
 * and global styles. See docs/design/ for the approved look.
 */
import type { ReactNode } from "react";
import "@/styles/globals.css";
import "@/styles/shell.css";
import "@/styles/dashboard.css";
import "@/styles/exam.css";
import "@/styles/print.css";

export const metadata = { title: "STLab — AI Engineering Lab" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: browser extensions (Grammarly etc.) inject
          data-* attributes onto <body> before React hydrates; that mismatch
          is expected and not a real bug — see the dev console note this
          silences. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
