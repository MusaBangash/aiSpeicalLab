"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const result = await signIn("credentials", { email, password, redirect: false });

    if (!result || result.error) {
      setError("Incorrect email or password.");
      setPending(false);
      return;
    }
    // Read by AttendanceToast (student layout) — cleared there after showing
    // once, so it never re-fires on a later navigation/refresh this tab.
    sessionStorage.setItem("stlab-attendance-toast", "pending");
    // Role-based landing is decided by src/app/page.tsx.
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error ? <div className="field-error">{error}</div> : null}
      <Button type="submit" disabled={pending} style={{ width: "100%", justifyContent: "center", marginTop: 6 }}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
