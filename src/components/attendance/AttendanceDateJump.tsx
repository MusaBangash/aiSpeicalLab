"use client";

import { useRouter } from "next/navigation";

export function AttendanceDateJump({ initialDate }: { initialDate: string }) {
  const router = useRouter();
  return (
    <input
      type="date"
      defaultValue={initialDate}
      onChange={(e) => {
        if (e.target.value) router.push(`/teacher/attendance?date=${e.target.value}`);
      }}
    />
  );
}
