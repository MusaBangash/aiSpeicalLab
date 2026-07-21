# STLab Agent

Small Python service installed on each of the 12 student PCs.

## Jobs
1. **Session tracking** — reports student login/logout to the server
2. **Heartbeat** — pings the server every 60s (`/api/agent/heartbeat`);
   this powers automatic attendance and the live pulse grid
3. **Activity telemetry** — reports the focused app/window title and
   idle time each heartbeat (`activity.py`), so teachers can see on-task
   vs. off-task without the server ever seeing full browsing history
4. **On-demand screen viewing** — when a teacher starts viewing this PC's
   screen, the agent captures and uploads a JPEG snapshot every ~2s
   (`screen.py`) and shows a mandatory, unclosable on-screen banner for
   the entire duration (`overlay.py`) — see the ethics section below,
   this is a narrowly-scoped exception, not a silent policy change
5. **Exam lockdown** — when the server says an exam attempt is IN_PROGRESS
   for this PC's student, the agent enters exam mode: closes browsers except
   the exam page, blocks app switching, restores on finish/timeout
   (`lockdown.py` is still a scaffold — `NotImplementedError` on both
   functions — separate work, not blocking the rest of the agent)

## Identity
Students roam between PCs (12 PCs, 12 students, not fixed 1:1). Each PC
is derived fresh every tick from the logged-in Windows account — assumes
one Windows account per student, named to match the email convention
already used in `prisma/seed.ts` (`firstname.lastname` →
`firstname.lastname@student.stlab.local`). No student identity is
configured per-PC; `config.json` only needs this machine's own hostname.

## Ethics line (deliberate, updated for on-demand screen viewing)
Application-level telemetry only by default — which app is focused,
idle/active — plus one narrowly-scoped, opt-in exception: a teacher can
start an on-demand LIVE VIEW of one student's screen (~1-2s snapshot
cadence, never continuous video or audio). The moment that is happening,
this agent shows an unmissable, unclosable on-screen banner for the
entire duration — there is no silent or hidden mode in any code path.
Casual viewing (no explicit "Save" click) writes nothing to disk or the
database; only an explicit "Save this session" action starts persisting
frames, and only from that click forward, never retroactively. Saved
recordings are kept indefinitely and visible only to the teacher who
saved them — a tradeoff worth revisiting before a real multi-school
deployment, not something to silently keep as-is forever.

Everything else from the original policy is unchanged: NO keystroke
logging, NO webcam, NO background/continuous recording, NO capture
without the banner being shown at the same time. `activity.py`'s idle
detection still reads a single OS-maintained "time since last input"
counter, never key values; window titles are read as opaque strings,
never URL/page content.

## Install (per PC)
```bash
pip install -r requirements.txt
cp config.example.json config.json   # set server URL, API key, hostname
python agent.py                      # or install as a Windows service / systemd unit
```
