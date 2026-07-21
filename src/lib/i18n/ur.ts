import type { Dictionary } from "./en";

/**
 * Urdu translations are out of scope for v1 (per the implementation brief)
 * — this mirrors `en`'s keys so the dictionary shape stays in sync and the
 * language switch is wired end-to-end, ready for real translations later.
 */
export const ur: Dictionary = {
  nav: {
    dashboard: "Dashboard",
    curriculum: "Curriculum",
    exercises: "Exercises",
    exams: "Exams",
    attendance: "Attendance",
    progress: "Progress",
    settings: "Settings",
    console: "Console",
    students: "Students",
  },
  common: {
    signIn: "Sign in",
    signOut: "Sign out",
    save: "Save changes",
    cancel: "Cancel",
  },
  metrics: {
    participation: "Participation",
    behaviour: "Behaviour",
    extraActivity: "Extra activity",
    examAverage: "Average exam score",
    attendance: "Attendance",
    addEntry: "Add entry",
    note: "Note (optional)",
    rating: "Rating",
    noEntries: "No entries yet.",
    entryHistory: "Entry history",
  },
};
