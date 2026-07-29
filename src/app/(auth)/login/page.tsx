/**
 * Login — one email/password form for both roles (the mockup's two-role
 * cards are visual only; role comes from the User row, not the form).
 */
import { PineLogo } from "@/components/shell/PineLogo";
import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="card login-card">
      <div className="login-logo-row">
        <div className="login-crown">
          <PineLogo />
        </div>
        <div className="login-brand">Ananas</div>
        <div className="logo-sub">AI Lab System</div>
      </div>
      <LoginForm />
      <div className="login-inst">Aisha Cahn College of Computer Science and Design Technology</div>
    </div>
  );
}
