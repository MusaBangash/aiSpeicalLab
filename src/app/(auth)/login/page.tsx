/**
 * Login — one email/password form for both roles (the mockup's two-role
 * cards are visual only; role comes from the User row, not the form).
 */
import { PineLogo } from "@/components/shell/PineLogo";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="card" style={{ width: 380, maxWidth: "100%", padding: 34 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 26 }}>
        <PineLogo className="logo-mark" />
        <div style={{ fontSize: 18, fontWeight: 800, marginTop: 10 }}>
          Anan<em style={{ fontStyle: "normal", color: "var(--gold-deep)" }}>as</em>
        </div>
        <div className="logo-sub">AI Lab System</div>
      </div>
      <LoginForm />
    </div>
  );
}
