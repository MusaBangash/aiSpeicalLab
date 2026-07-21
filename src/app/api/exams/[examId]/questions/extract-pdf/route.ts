/**
 * POST /api/exams/:id/questions/extract-pdf — extract text locally from
 * an uploaded PDF (no network calls, no AI) and run it through the same
 * template parser as "paste multiple".
 */
import { PDFParse } from "pdf-parse";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseQuestionTemplate } from "@/lib/questionParser";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { examId } = await params;
  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) return Response.json({ error: "Exam not found" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return Response.json({ error: "File must be a PDF" }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: "PDF must be under 10MB" }, { status: 400 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const parser = new PDFParse({ data: buffer });
  let text: string;
  try {
    const pdfResult = await parser.getText();
    // Check per-page text, not the concatenated `pdfResult.text` — pdf-parse
    // always appends a "-- N of N --" separator per page, which survives
    // a plain trim() check even when every page is genuinely blank
    // (verified live against a hand-built no-text-layer PDF).
    const hasRealText = pdfResult.pages.some((p) => p.text.trim().length > 0);
    if (!hasRealText) {
      return Response.json(
        { error: "Could not read text from this PDF — it may be a scanned image without selectable text." },
        { status: 422 }
      );
    }
    text = pdfResult.text;
  } catch {
    return Response.json({ error: "Could not read this file — it may not be a valid PDF." }, { status: 400 });
  } finally {
    await parser.destroy();
  }

  const parseResult = parseQuestionTemplate(text);
  return Response.json({ parsed: parseResult.parsed, unparsedText: parseResult.unparsedText, warnings: parseResult.warnings });
}
