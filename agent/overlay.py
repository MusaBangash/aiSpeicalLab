"""
Mandatory on-screen indicator, shown for the ENTIRE duration a teacher is
actively viewing this PC's screen -- non-negotiable, no toggle to hide it
anywhere in this codebase. Runs Tkinter's mainloop on the main thread only
(Tkinter/Tcl are not guaranteed thread-safe otherwise); agent.py's
background threads communicate purely through `overlay_visible`
(threading.Event), never touching a Tk widget directly.

Renders regardless of which application currently has focus:
overrideredirect removes the titlebar/border (so it can't be closed or
dragged away by the student) and -topmost keeps it above every other
window, including whatever the student is using (VS Code, a browser,
anything).

Known limitation: exclusive-fullscreen apps (some games/video players) can
occlude even topmost windows at the OS level -- a general limitation of
any "always on top" window, not something this module can fully defeat
without a lower-level hook, which is out of scope.
"""
import threading
import tkinter as tk

CHECK_MS = 250


def run(overlay_visible: threading.Event) -> None:
    root = tk.Tk()
    root.withdraw()

    banner = tk.Toplevel(root)
    banner.withdraw()
    banner.overrideredirect(True)  # no titlebar/border/close button
    banner.attributes("-topmost", True)  # always above every other window
    banner.configure(bg="#c0392b")

    label = tk.Label(
        banner,
        text="\U0001F534  Your screen is being viewed by a teacher",
        bg="#c0392b",
        fg="white",
        font=("Segoe UI", 11, "bold"),
        padx=16,
        pady=6,
    )
    label.pack()

    screen_w = root.winfo_screenwidth()

    def reposition():
        banner.update_idletasks()
        w = banner.winfo_width()
        banner.geometry(f"+{(screen_w - w) // 2}+8")  # centered pill, near top edge

    visible = False

    def check_flag():
        nonlocal visible
        should_show = overlay_visible.is_set()
        if should_show and not visible:
            banner.deiconify()
            reposition()
            visible = True
        elif not should_show and visible:
            banner.withdraw()
            visible = False
        elif should_show:
            banner.attributes("-topmost", True)  # re-assert -- some apps steal the top spot
        root.after(CHECK_MS, check_flag)

    root.after(CHECK_MS, check_flag)
    root.mainloop()
