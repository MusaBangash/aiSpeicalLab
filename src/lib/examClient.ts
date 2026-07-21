/** Typed fetch wrappers for the exam API — the one place the client-side contract lives. */

export type ExamQuestion = {
  id: string;
  text: string;
  options: { id: string; text: string; order: number }[];
};

export type StartExamResponse =
  | {
      attemptId: string;
      attemptNumber: number;
      expiresAt: string;
      status: "IN_PROGRESS";
      questions: ExamQuestion[];
      answers: Record<string, string | null>;
    }
  | { blocked: true; reason: "SEALED"; scorePercent: number; verificationId: string }
  | { blocked: true; reason: "IN_PROGRESS"; attemptId: string }
  | { blocked: true; reason: "COOLDOWN"; availableAt: string };

export type FinishExamResponse = {
  scorePercent: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
  verificationId: string;
};

export async function startExam(examId: string): Promise<StartExamResponse> {
  const res = await fetch(`/api/exams/${examId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function saveAnswer(
  examId: string,
  attemptId: string,
  questionId: string,
  optionId: string | null
): Promise<{ saved: true } | { error: string; code: string }> {
  const res = await fetch(`/api/exams/${examId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attemptId, questionId, optionId }),
  });
  return res.json();
}

export async function finishExam(examId: string, attemptId: string): Promise<FinishExamResponse> {
  const res = await fetch(`/api/exams/${examId}/finish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ attemptId }),
  });
  return res.json();
}
