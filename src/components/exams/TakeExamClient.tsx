"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PineLogo } from "@/components/shell/PineLogo";
import { Icon } from "@/components/shell/Icon";
import { LockdownBar } from "./LockdownBar";
import { QuestionCard, useFlash } from "./QuestionCard";
import { QuestionNavigator } from "./QuestionNavigator";
import { FinishConfirmSheet } from "./FinishConfirmSheet";
import { startExam, saveAnswer as saveAnswerApi, finishExam, type ExamQuestion } from "@/lib/examClient";

type Attempt = {
  attemptId: string;
  attemptNumber: number;
  expiresAt: string;
  questions: ExamQuestion[];
  pcHostname: string | null;
};

export function TakeExamClient({
  examId,
  examTitle,
  durationMinutes,
  questionsShown,
  studentName,
  autoStart,
}: {
  examId: string;
  examTitle: string;
  durationMinutes: number;
  questionsShown: number;
  studentName: string;
  autoStart: boolean;
}) {
  const router = useRouter();
  const [screen, setScreen] = useState<"intro" | "exam" | "loading">(autoStart ? "loading" : "intro");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [cur, setCur] = useState(0);
  const [showFinishSheet, setShowFinishSheet] = useState(false);
  const [justSaved, trigger] = useFlash(1400);
  const [finishing, setFinishing] = useState(false);

  async function begin() {
    setScreen("loading");
    const res = await startExam(examId);
    if ("blocked" in res) {
      // Already sealed/on cooldown by the time this fired — bounce back to the list.
      router.push("/student/exams");
      return;
    }
    setAttempt({
      attemptId: res.attemptId,
      attemptNumber: res.attemptNumber,
      expiresAt: res.expiresAt,
      questions: res.questions,
      pcHostname: null,
    });
    setAnswers(res.answers);
    setScreen("exam");
  }

  useEffect(() => {
    if (autoStart) void begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answeredIds = useMemo(() => {
    const s = new Set<number>();
    attempt?.questions.forEach((q, i) => {
      if (answers[q.id]) s.add(i);
    });
    return s;
  }, [attempt, answers]);

  async function handleSelect(optionId: string) {
    if (!attempt) return;
    const question = attempt.questions[cur];
    setAnswers((prev) => ({ ...prev, [question.id]: optionId }));
    trigger();
    const res = await saveAnswerApi(examId, attempt.attemptId, question.id, optionId);
    if ("code" in res && res.code === "EXPIRED") {
      await handleFinish();
    }
  }

  async function handleFinish() {
    if (!attempt || finishing) return;
    setFinishing(true);
    setShowFinishSheet(false);
    await finishExam(examId, attempt.attemptId);
    router.push(`/student/exams/${examId}/result`);
  }

  if (screen === "loading") {
    return (
      <div className="intro">
        <PineLogo className="pine" />
        <h1>Loading…</h1>
      </div>
    );
  }

  if (screen === "intro") {
    return (
      <div className="stage">
        <div className="intro">
          <PineLogo className="pine" />
          <h1>{examTitle}</h1>
          <p className="sub">Once you begin, this PC locks into exam mode until you finish or time runs out.</p>
          <div className="rules">
            <div className="rule">
              <div className="ic">
                <Icon name="list" size={19} />
              </div>
              <div>
                <div className="t">{questionsShown} questions</div>
                <div className="s">Drawn from the module bank</div>
              </div>
            </div>
            <div className="rule">
              <div className="ic">
                <Icon name="clock" size={19} />
              </div>
              <div>
                <div className="t">{durationMinutes} minutes</div>
                <div className="s">Auto-submits at zero</div>
              </div>
            </div>
            <div className="rule">
              <div className="ic">
                <Icon name="swap" size={19} />
              </div>
              <div>
                <div className="t">Change freely</div>
                <div className="s">Answers save as you go</div>
              </div>
            </div>
            <div className="rule">
              <div className="ic">
                <Icon name="target" size={19} />
              </div>
              <div>
                <div className="t">Pass to seal it</div>
                <div className="s">Retake after cooldown if needed</div>
              </div>
            </div>
          </div>
          <button className="btn" onClick={begin}>
            <Icon name="play" size={16} />
            Begin exam
          </button>
        </div>
      </div>
    );
  }

  if (!attempt) return null;
  const question = attempt.questions[cur];

  return (
    <>
      <LockdownBar
        title={examTitle}
        studentName={studentName}
        pcHostname={attempt.pcHostname}
        attemptNumber={attempt.attemptNumber}
        expiresAt={attempt.expiresAt}
        onExpire={handleFinish}
      />
      <div className="stage">
        <div className="exam-wrap">
          <QuestionCard
            question={question}
            index={cur}
            total={attempt.questions.length}
            selectedOptionId={answers[question.id] ?? null}
            justSaved={justSaved}
            onSelect={handleSelect}
            onPrev={() => setCur((i) => Math.max(0, i - 1))}
            onNext={() => setCur((i) => Math.min(attempt.questions.length - 1, i + 1))}
          />
          <QuestionNavigator
            total={attempt.questions.length}
            answeredIds={answeredIds}
            currentIndex={cur}
            onJump={setCur}
            onFinish={() => setShowFinishSheet(true)}
          />
        </div>
      </div>
      {showFinishSheet ? (
        <FinishConfirmSheet
          unansweredCount={attempt.questions.length - answeredIds.size}
          onCancel={() => setShowFinishSheet(false)}
          onConfirm={handleFinish}
        />
      ) : null}
    </>
  );
}
