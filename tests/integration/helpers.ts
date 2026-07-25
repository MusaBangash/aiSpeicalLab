/** Shared fixture builders for integration tests — each returns its id plus
 *  a cleanup() that deletes exactly what it created, in FK-safe order.
 *  Mirrors the exact manual create->verify->clean-up discipline already
 *  used throughout this project's curl-based verification, just automated. */
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function createTestLab() {
  const lab = await db.lab.create({ data: { name: `Test Lab ${Date.now()}-${Math.random()}` } });
  return { id: lab.id, cleanup: async (): Promise<void> => { await db.lab.delete({ where: { id: lab.id } }); } };
}

export async function createTestTeacher(labId?: string) {
  const hash = await bcrypt.hash("test-password-123", 10);
  const teacher = await db.user.create({
    data: { name: "Test Teacher", email: `test.teacher.${Date.now()}.${Math.random()}@stlab.local`, password: hash, role: "TEACHER", labId },
  });
  return { id: teacher.id, cleanup: async (): Promise<void> => { await db.user.delete({ where: { id: teacher.id } }); } };
}

export async function createTestStudent(labId?: string) {
  const hash = await bcrypt.hash("test-password-123", 10);
  const student = await db.user.create({
    data: { name: "Test Student", email: `test.student.${Date.now()}.${Math.random()}@student.stlab.local`, password: hash, role: "STUDENT", labId },
  });
  return { id: student.id, cleanup: async (): Promise<void> => { await db.user.delete({ where: { id: student.id } }); } };
}

export async function createTestModule() {
  const moduleCount = await db.curriculumModule.count();
  const module = await db.curriculumModule.create({ data: { title: `Test Module ${Date.now()}-${Math.random()}`, order: moduleCount + 1 } });
  return { id: module.id, cleanup: async (): Promise<void> => { await db.curriculumModule.delete({ where: { id: module.id } }); } };
}

/** Creates an exam with `optionsPerQuestion.length` questions, each with 4
 *  options where `correctIndex` marks the correct one. Returns the exam id,
 *  the question ids (in creation order) and each question's correct
 *  option id, plus cleanup covering exam+questions+options together. */
export async function createTestExam(
  moduleId: string,
  opts: { passMarkPercent?: number; questionCount?: number } = {}
) {
  const exam = await db.exam.create({
    data: {
      moduleId,
      title: `Test Exam ${Date.now()}-${Math.random()}`,
      status: "PUBLISHED",
      durationMinutes: 30,
      questionsShown: opts.questionCount ?? 4,
      passMarkPercent: opts.passMarkPercent ?? 50,
    },
  });

  const questionCount = opts.questionCount ?? 4;
  const questions: { id: string; correctOptionId: string; wrongOptionId: string }[] = [];
  for (let i = 0; i < questionCount; i++) {
    const question = await db.question.create({
      data: {
        examId: exam.id,
        text: `Test question ${i + 1}`,
        order: i + 1,
        options: {
          create: [
            { text: "A", isCorrect: true, order: 1 },
            { text: "B", isCorrect: false, order: 2 },
            { text: "C", isCorrect: false, order: 3 },
            { text: "D", isCorrect: false, order: 4 },
          ],
        },
      },
      include: { options: { orderBy: { order: "asc" } } },
    });
    questions.push({
      id: question.id,
      correctOptionId: question.options[0].id,
      wrongOptionId: question.options[1].id,
    });
  }

  return {
    examId: exam.id,
    questions,
    cleanup: async () => {
      const questionIds = questions.map((q) => q.id);
      await db.attemptAnswer.deleteMany({ where: { questionId: { in: questionIds } } });
      await db.examRecord.deleteMany({ where: { examId: exam.id } });
      await db.examAttempt.deleteMany({ where: { examId: exam.id } });
      await db.questionOption.deleteMany({ where: { questionId: { in: questionIds } } });
      await db.question.deleteMany({ where: { examId: exam.id } });
      await db.exam.delete({ where: { id: exam.id } });
    },
  };
}
