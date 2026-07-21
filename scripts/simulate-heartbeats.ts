/**
 * Dev-only simulator: fakes the 12 lab agents' heartbeats so the
 * attendance system is testable without real lab PCs. Also periodically
 * triggers the sweep cron so exam timeouts get exercised in dev too.
 *
 * Usage: npm run simulate
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const AGENT_API_KEY = process.env.AGENT_API_KEY;
const HEARTBEAT_INTERVAL_MS = 10_000;
const SWEEP_INTERVAL_MS = 60_000;

// Fake app-focus telemetry so ActivitySegment is exercisable without real PCs/agents.
const FAKE_APPS: { app: string; title: string }[] = [
  { app: "Code.exe", title: "activity.ts — stlab — Visual Studio Code" },
  { app: "chrome.exe", title: "STLab — Curriculum" },
  { app: "WindowsTerminal.exe", title: "python agent.py" },
  { app: "notepad.exe", title: "notes.txt — Notepad" },
];

if (!AGENT_API_KEY) {
  console.error("AGENT_API_KEY is not set — check your .env");
  process.exit(1);
}

async function main() {
  const pcs = await db.pC.findMany({ orderBy: { hostname: "asc" } });
  const students = await db.user.findMany({ where: { role: "STUDENT" }, orderBy: { name: "asc" } });

  const pairCount = Math.min(pcs.length, students.length);
  const pairs = Array.from({ length: pairCount }, (_, i) => ({ pc: pcs[i], student: students[i] }));

  console.log(`Simulating ${pairs.length} lab PCs, heartbeat every ${HEARTBEAT_INTERVAL_MS / 1000}s.`);

  async function sendHeartbeats() {
    // Not every PC is "on" every tick — mimics students stepping away.
    const online = pairs.filter(() => Math.random() > 0.15);
    await Promise.all(
      online.map(({ pc, student }) => {
        const focus = FAKE_APPS[Math.floor(Math.random() * FAKE_APPS.length)];
        // Mostly active, occasionally a long idle stretch to exercise the idle path.
        const idleSeconds = Math.random() > 0.8 ? Math.floor(Math.random() * 300) : Math.floor(Math.random() * 30);
        return fetch(`${BASE_URL}/api/agent/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-agent-key": AGENT_API_KEY! },
          body: JSON.stringify({
            hostname: pc.hostname,
            studentEmail: student.email,
            focusedApp: focus.app,
            windowTitle: focus.title,
            idleSeconds,
          }),
        }).catch((err) => console.error(`heartbeat failed for ${pc.hostname}:`, err.message));
      })
    );
    console.log(`[${new Date().toLocaleTimeString()}] sent ${online.length}/${pairs.length} heartbeats`);
  }

  async function sweep() {
    const res = await fetch(`${BASE_URL}/api/cron/sweep`, { headers: { "x-agent-key": AGENT_API_KEY! } }).catch(
      (err) => {
        console.error("sweep failed:", err.message);
        return null;
      }
    );
    if (res?.ok) {
      const body = await res.json();
      console.log(`[${new Date().toLocaleTimeString()}] sweep:`, body);
    }
  }

  await sendHeartbeats();
  await sweep();
  setInterval(sendHeartbeats, HEARTBEAT_INTERVAL_MS);
  setInterval(sweep, SWEEP_INTERVAL_MS);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
