"""
Exam lockdown for student PCs.

enter(exam_url): open exam full-screen (kiosk), block task switching,
                 close other user apps.
exit():          restore normal desktop.

STATUS: scaffold. Windows first (lab PCs are Windows);
keep a clean interface so a Linux backend can be added later.
"""

def enter(exam_url: str) -> None:
    raise NotImplementedError

def exit() -> None:
    raise NotImplementedError
