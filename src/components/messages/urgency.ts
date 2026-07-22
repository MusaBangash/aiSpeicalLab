import type { CSSProperties } from "react";
import type { MessageUrgency } from "@prisma/client";

export const URGENCY_STYLE: Record<MessageUrgency, CSSProperties> = {
  NORMAL: { borderLeft: "4px solid var(--line-2)" },
  IMPORTANT: { borderLeft: "4px solid var(--gold)" },
  URGENT: { borderLeft: "4px solid var(--coral)" },
};

export const URGENCY_LABEL: Record<MessageUrgency, string> = {
  NORMAL: "Normal",
  IMPORTANT: "Important",
  URGENT: "Urgent",
};
