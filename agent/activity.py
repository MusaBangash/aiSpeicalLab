"""
Windows-only foreground-app + idle-time detection, and Windows-username
-> STLab-email derivation.

Identity is derived from the FOREGROUND WINDOW's owning process, not the
agent process's own owner. This works whether agent.py runs inside the
logged-in student's session or as a background service under a system
account -- either way, whatever the student is actually looking at is
owned by their own Windows account. It also gives a natural "no student
logged in" signal for free: at the lock/login screen the foreground
window (e.g. LogonUI.exe) is owned by SYSTEM, not a real user.

Ethics line (see README.md): idle detection reads a single OS-maintained
counter (milliseconds since last input), not key values -- this is NOT
keystroke logging. Foreground window title is read, not page/URL content
-- this is app/window-title level telemetry, not browsing history.
"""
import ctypes

import psutil
import win32gui
import win32process

SYSTEM_ACCOUNTS = {"SYSTEM", "LOCAL SERVICE", "NETWORK SERVICE"}


class _LASTINPUTINFO(ctypes.Structure):
    _fields_ = [("cbSize", ctypes.c_uint), ("dwTime", ctypes.c_uint)]


def get_idle_seconds() -> int:
    """Seconds since the last keyboard/mouse input, system-wide."""
    info = _LASTINPUTINFO()
    info.cbSize = ctypes.sizeof(_LASTINPUTINFO)
    ctypes.windll.user32.GetLastInputInfo(ctypes.byref(info))
    millis = ctypes.windll.kernel32.GetTickCount() - info.dwTime
    return max(0, int(millis / 1000))


def _foreground_app():
    """Returns (app_name, window_title, owner) for the current foreground
    window, or (None, None, None) if it can't be determined."""
    hwnd = win32gui.GetForegroundWindow()
    if not hwnd:
        return None, None, None
    title = win32gui.GetWindowText(hwnd)
    try:
        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        proc = psutil.Process(pid)
        app_name = proc.name()
        owner = proc.username()  # "COMPUTERNAME\\username" or "NT AUTHORITY\\SYSTEM"
    except (psutil.NoSuchProcess, psutil.AccessDenied, OSError):
        app_name, owner = None, None
    return app_name, title, owner


def _derive_student_email(owner) -> str | None:
    if not owner:
        return None
    username = owner.split("\\")[-1].strip()
    if not username or username.upper() in SYSTEM_ACCOUNTS:
        return None
    # Windows accounts on lab PCs are one-per-student, named "firstname.lastname"
    # -- same convention as prisma/seed.ts's email generation.
    return f"{username.lower()}@student.stlab.local"


def collect() -> dict | None:
    """Returns telemetry for this tick, or None if no student is
    currently logged in (agent.py should skip sending a heartbeat)."""
    app_name, title, owner = _foreground_app()
    student_email = _derive_student_email(owner)
    if student_email is None:
        return None
    return {
        "studentEmail": student_email,
        # focusedApp must be non-empty (server requires it); windowTitle may
        # legitimately be empty (some windows report none).
        "focusedApp": app_name or "Unknown",
        "windowTitle": title or "",
        "idleSeconds": get_idle_seconds(),
    }
