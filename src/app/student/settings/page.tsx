/** Settings (profile, language en/ur, preferences) */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/shell/PageHeader";
import { SettingsForm } from "@/components/settings/SettingsForm";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });

  return (
    <div className="page-anim">
      <PageHeader title="Settings" />
      <SettingsForm
        initialName={user.name}
        email={user.email}
        initialLanguage={user.language}
        initialPreferences={{
          examReminders: user.examReminders,
          streakAlerts: user.streakAlerts,
          showOnWall: user.showOnWall,
        }}
      />
    </div>
  );
}
