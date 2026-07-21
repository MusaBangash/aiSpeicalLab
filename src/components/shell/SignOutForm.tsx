import { signOut } from "@/lib/auth";
import { Icon } from "./Icon";

export function SignOutForm() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button type="submit" className="signout-btn" aria-label="Sign out" title="Sign out">
        <Icon name="logout" size={18} />
      </button>
    </form>
  );
}
