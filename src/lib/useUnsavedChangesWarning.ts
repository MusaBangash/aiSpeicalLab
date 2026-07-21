"use client";

import { useEffect } from "react";

/**
 * Warns on tab close/refresh while `isDirty`. Covers that case only —
 * Next.js App Router client-side navigation (<Link>, router.push) doesn't
 * fire `beforeunload` at all, and there's no simple built-in hook to
 * intercept it; a full router-level guard is more machinery than this
 * warrants, so in-app navigation isn't covered.
 */
export function useUnsavedChangesWarning(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
