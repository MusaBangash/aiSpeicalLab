export const en = {
  nav: {
    dashboard: "Dashboard",
    curriculum: "Curriculum",
    exercises: "Homework",
    exams: "Exams",
    attendance: "Attendance",
    progress: "Progress",
    settings: "Settings",
    console: "Console",
    students: "Students",
    classes: "Classes",
    messages: "Messages",
    homework: "Homework",
    questions: "Questions",
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
} as const;

export type Dictionary = typeof en;
