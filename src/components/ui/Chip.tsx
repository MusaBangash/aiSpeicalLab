import type { ReactNode } from "react";

type Variant = "done" | "active" | "locked" | "star" | "coral";

export function Chip({ variant, children }: { variant: Variant; children: ReactNode }) {
  return <span className={`chip ${variant}`}>{children}</span>;
}
