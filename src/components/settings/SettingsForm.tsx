"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";

type Preferences = { examReminders: boolean; streakAlerts: boolean; showOnWall: boolean };

export function SettingsForm({
  initialName,
  email,
  initialLanguage,
  initialPreferences,
}: {
  initialName: string;
  email: string;
  initialLanguage: string;
  initialPreferences: Preferences;
}) {
  const [name, setName] = useState(initialName);
  const [language, setLanguage] = useState(initialLanguage);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const [preferences, setPreferences] = useState(initialPreferences);

  async function saveProfile() {
    setProfileSaving(true);
    setProfileSaved(false);
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, language }),
    });
    setProfileSaving(false);
    if (res.ok) {
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2000);
    }
  }

  async function savePassword() {
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSaved(false);
    const res = await fetch("/api/settings/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    setPasswordSaving(false);
    if (!res.ok) {
      const body = await res.json();
      setPasswordError(body.error ?? "Could not change password.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setPasswordSaved(true);
    setTimeout(() => setPasswordSaved(false), 2000);
  }

  async function togglePreference(key: keyof Preferences) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    const res = await fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next[key] }),
    });
    if (!res.ok) setPreferences(preferences); // revert on failure
  }

  return (
    <div className="set-grid">
      <div className="card set-card">
        <div className="set-title">Profile</div>
        <div className="field">
          <label htmlFor="name">Full name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" value={email} disabled />
        </div>
        <div className="field">
          <label htmlFor="language">Interface language</label>
          <select id="language" value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="ur">اردو (Urdu)</option>
          </select>
        </div>
        <Button type="button" onClick={saveProfile} disabled={profileSaving} style={{ marginTop: 6 }}>
          {profileSaving ? "Saving…" : profileSaved ? "Saved" : "Save changes"}
        </Button>

        <div className="set-title" style={{ marginTop: 26 }}>
          Change password
        </div>
        <div className="field">
          <label htmlFor="current-password">Current password</label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="new-password">New password</label>
          <input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        {passwordError ? <div className="field-error">{passwordError}</div> : null}
        <Button
          type="button"
          variant="ghost"
          onClick={savePassword}
          disabled={passwordSaving || !currentPassword || newPassword.length < 8}
        >
          {passwordSaving ? "Saving…" : passwordSaved ? "Saved" : "Change password"}
        </Button>
      </div>

      <div className="card set-card">
        <div className="set-title">Preferences</div>
        <div className="tog-row">
          <div>
            <div className="tog-t">Exam reminders</div>
            <div className="tog-s">Notify me a day before each exam</div>
          </div>
          <Toggle
            on={preferences.examReminders}
            onToggle={() => togglePreference("examReminders")}
            label="Exam reminders"
          />
        </div>
        <div className="tog-row">
          <div>
            <div className="tog-t">Streak alerts</div>
            <div className="tog-s">Warn me before I break my streak</div>
          </div>
          <Toggle on={preferences.streakAlerts} onToggle={() => togglePreference("streakAlerts")} label="Streak alerts" />
        </div>
        <div className="tog-row">
          <div>
            <div className="tog-t">Show me on the class wall</div>
            <div className="tog-s">Appear on the projector pulse grid</div>
          </div>
          <Toggle on={preferences.showOnWall} onToggle={() => togglePreference("showOnWall")} label="Class wall" />
        </div>
      </div>
    </div>
  );
}
