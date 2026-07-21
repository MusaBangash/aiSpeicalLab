/**
 * Seed: one lab, 12 PCs, teacher (Bangash), 12 demo students,
 * 6 curriculum modules, and one published Module 4 MCQ exam
 * (bank of 12 questions, 8 shown, 30 min, 24h cooldown, pass 82%).
 * Also seeds demo progress/attendance/session fixtures so the
 * dashboards aren't empty on first login (v1 has no curriculum/exercise
 * write path yet — see docs/05-implementation-notes.md).
 *
 * Run: npx prisma db seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { startOfDay } from "../src/lib/attendance";

const db = new PrismaClient();

async function main() {
  const lab = await db.lab.create({
    data: { name: "AI Engineering Lab", location: "Muslim Hands Complex, Wazirabad" },
  });

  // 12 PCs
  const pcs = [];
  for (let i = 1; i <= 12; i++) {
    pcs.push(
      await db.pC.create({
        data: { hostname: `AILAB-PC-${String(i).padStart(2, "0")}`, labId: lab.id },
      })
    );
  }

  const hash = await bcrypt.hash("change-me-123", 10);

  await db.user.create({
    data: { name: "Bangash", email: "bangash@stlab.local", password: hash, role: "TEACHER", labId: lab.id },
  });

  const studentNames = [
    "Ahmad Ali", "Zara Khan", "Bilal Sheikh", "Hina Aslam", "Usman Tariq", "Sana Riaz",
    "Fahad Iqbal", "Mariam Yousaf", "Hamza Farooq", "Ayesha Noor", "Waleed Anjum", "Rabia Saeed",
  ];
  const students = [];
  for (const name of studentNames) {
    const email = name.toLowerCase().replace(" ", ".") + "@student.stlab.local";
    students.push(await db.user.create({ data: { name, email, password: hash, role: "STUDENT", labId: lab.id } }));
  }

  const moduleTitles = [
    "Python foundations", "Data structures", "NumPy and pandas",
    "Neural network basics", "Computer vision intro", "Capstone project",
  ];
  const modules = [];
  for (let i = 0; i < moduleTitles.length; i++) {
    modules.push(await db.curriculumModule.create({
      data: { title: moduleTitles[i], order: i + 1 },
    }));
  }

  // Module 4 exam — matches docs/02-exam-spec.md
  const exam = await db.exam.create({
    data: {
      moduleId: modules[3].id,
      title: "Module 4 exam — Neural network basics",
      status: "PUBLISHED",
      durationMinutes: 30,
      cooldownHours: 24,
      passMarkPercent: 82,
      questionsShown: 8,
    },
  });

  // Full 12-question bank (8 shown per attempt). The first 8 reuse
  // docs/design/exam_ui.html's question set verbatim for design
  // continuity; the last 4 are new, same topic.
  const bank: { text: string; options: string[]; correctIndex: number }[] = [
    {
      text: "What does a single perceptron compute?",
      options: [
        "A weighted sum of inputs passed through an activation",
        "The average of all inputs",
        "The maximum input value",
        "A random binary output",
      ],
      correctIndex: 0,
    },
    {
      text: "In training, what does the learning rate control?",
      options: [
        "How many layers the network has",
        "The size of each weight update step",
        "The number of training examples",
        "The activation function used",
      ],
      correctIndex: 1,
    },
    {
      text: "Backpropagation is used to…",
      options: [
        "Generate new training data",
        "Choose the network architecture",
        "Compute gradients of the loss with respect to weights",
        "Normalize the input features",
      ],
      correctIndex: 2,
    },
    {
      text: "Which activation outputs values between 0 and 1?",
      options: ["ReLU", "Tanh", "Sigmoid", "Linear"],
      correctIndex: 2,
    },
    {
      text: "What happens if the learning rate is far too high?",
      options: [
        "Training becomes very slow but stable",
        "The loss can oscillate or explode",
        "The network needs fewer epochs",
        "Nothing — it always converges",
      ],
      correctIndex: 1,
    },
    {
      text: "A loss function measures…",
      options: [
        "How fast the model trains",
        "How far predictions are from the true values",
        "The number of neurons used",
        "The memory used by the model",
      ],
      correctIndex: 1,
    },
    {
      text: "Why do we use non-linear activations at all?",
      options: [
        "They make training faster",
        "Without them, stacked layers collapse into one linear function",
        "They reduce memory usage",
        "They are required by Python",
      ],
      correctIndex: 1,
    },
    {
      text: "One full pass over the training dataset is called…",
      options: ["A batch", "An iteration", "An epoch", "A gradient"],
      correctIndex: 2,
    },
    {
      text: "What is overfitting?",
      options: [
        "The model memorizes training data but fails to generalize to new data",
        "The model trains too quickly",
        "The model uses too few parameters",
        "The model's loss never decreases",
      ],
      correctIndex: 0,
    },
    {
      text: "Why split data into train/validation/test sets?",
      options: [
        "To measure how well the model generalizes to data it hasn't seen",
        "To make training faster",
        "To reduce the number of features",
        "It's required by every ML library",
      ],
      correctIndex: 0,
    },
    {
      text: "Why not initialize all weights to zero?",
      options: [
        "Every neuron would compute the same gradient and update identically, so the network can't learn distinct features",
        "It would make training too fast",
        "Zero weights cause a syntax error",
        "It only affects the output layer",
      ],
      correctIndex: 0,
    },
    {
      text: "What does a softmax output layer produce for multi-class classification?",
      options: [
        "A single binary value",
        "A probability distribution over the classes that sums to 1",
        "The raw class index",
        "A fixed-size embedding vector",
      ],
      correctIndex: 1,
    },
  ];

  for (const q of bank) {
    await db.question.create({
      data: {
        examId: exam.id,
        text: q.text,
        options: {
          create: q.options.map((text, i) => ({ text, isCorrect: i === q.correctIndex, order: i + 1 })),
        },
      },
    });
  }

  // Demo progress: Modules 1-3 complete, Module 4 in progress — gives the
  // dashboard progress ring/continue-card real data. Modules 5-6 are left
  // with no ProgressRecord (absence = not started).
  for (const student of students) {
    for (const mod of modules.slice(0, 3)) {
      await db.progressRecord.create({
        data: { studentId: student.id, moduleId: mod.id, status: "COMPLETE", completedAt: new Date() },
      });
    }
    await db.progressRecord.create({
      data: { studentId: student.id, moduleId: modules[3].id, status: "IN_PROGRESS" },
    });
  }

  // Demo attendance: present on the past two working weeks (excluding
  // today, which the heartbeat simulator can populate live) — gives the
  // heatmap, streak, and term % real data from day one.
  const today = startOfDay(new Date());
  for (let offset = 1; offset <= 14; offset++) {
    const day = new Date(today);
    day.setDate(day.getDate() - offset);
    if (day.getDay() === 0 || day.getDay() === 6) continue; // skip weekends

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      await db.attendance.create({
        data: { studentId: student.id, date: day, status: "PRESENT" },
      });

      // A closed lab session on the same day, so total-hours isn't zero.
      const pc = pcs[i % pcs.length];
      const startedAt = new Date(day);
      startedAt.setHours(9, 0, 0, 0);
      const endedAt = new Date(day);
      endedAt.setHours(9 + 2 + (i % 3), 30, 0, 0); // 2.5-4.5h sessions
      await db.session.create({
        data: { studentId: student.id, pcId: pc.id, startedAt, endedAt, lastHeartbeat: endedAt },
      });
    }
  }

  console.log("Seed complete.");
}

main().finally(() => db.$disconnect());
