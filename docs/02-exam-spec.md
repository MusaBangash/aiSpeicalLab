# Exam system v1 — locked spec

- MCQ only
- Taken on lab PCs, inside the system (any machine on the lab network)
- Lab agent locks the PC into exam mode while an attempt is IN_PROGRESS
- Teacher creates exams: title, module, timer (minutes), cooldown (hours),
  pass mark (default 82%), questions shown (random draw from the bank)
- Question bank per exam; retire questions with `active=false`, never delete
- Student can change any answer freely until pressing "Finish exam";
  every selection is auto-saved server-side the moment it's made
- Crash/disconnect: attempt + answers + frozen question set persist;
  student resumes on ANY lab PC; timer (expiresAt) keeps running
- Timer ends -> auto-submit whatever is saved
- Scoring is instant (self-marking); pass at >= 82%
- Retakes: allowed only if not yet passed, after the cooldown,
  each retake draws a fresh random question set
- Official score = latest attempt (ExamRecord); ALL attempts stored forever
- Passing seals the exam (sealedAt) — no more attempts
- Every ExamRecord carries a verificationId for certificates/QR

## Screens
1. Student: exam intro -> taking (timer, navigator, auto-save) -> result
   (approved design: docs/design/exam_ui.html)
2. Teacher: create exam -> question bank editor -> results with attempt history
