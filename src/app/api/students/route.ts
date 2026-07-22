/**
 * POST /api/students — teacher enrolls a new student: full profile fields,
 * an optional photo, and an optional class assignment. Returns the
 * generated email + plaintext password ONCE — never stored or logged.
 */
export const runtime = "nodejs";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createStudent } from "@/lib/students";
import { extensionForMimeType } from "@/lib/studentPhotoStorage";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

const bodySchema = z
  .object({
    name: z.string().trim().min(1),
    fatherName: z.string().trim().min(1),
    contact: z.string().trim().min(1),
    address: z.string().trim().min(1),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]),
    courseType: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "DIPLOMA", "OTHER"]),
    courseTypeOther: z.string().trim().optional(),
    category: z.enum(["PAYING", "ORPHAN", "STAFF", "OTHER"]),
    residency: z.enum(["DAY_SCHOLAR", "HOSTELIZED"]),
    educationLevel: z.string().trim().min(1),
    educationStatus: z.string().trim().min(1),
    classId: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.courseType === "OTHER" && !data.courseTypeOther) {
      ctx.addIssue({ code: "custom", path: ["courseTypeOther"], message: "Required when course type is Other" });
    }
  });

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Invalid request body" }, { status: 400 });

  const raw = {
    name: form.get("name"),
    fatherName: form.get("fatherName"),
    contact: form.get("contact"),
    address: form.get("address"),
    gender: form.get("gender"),
    courseType: form.get("courseType"),
    courseTypeOther: form.get("courseTypeOther") || undefined,
    category: form.get("category"),
    residency: form.get("residency"),
    educationLevel: form.get("educationLevel"),
    educationStatus: form.get("educationStatus"),
    classId: form.get("classId") || undefined,
  };
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }

  let photo: { bytes: Buffer; extension: string; mimeType: string } | undefined;
  const file = form.get("photo");
  if (file instanceof File && file.size > 0) {
    const extension = extensionForMimeType(file.type);
    if (!extension) {
      return Response.json({ error: "Photo must be a JPEG, PNG, or WebP image" }, { status: 400 });
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return Response.json({ error: "Photo must be under 5MB" }, { status: 400 });
    }
    photo = { bytes: Buffer.from(await file.arrayBuffer()), extension, mimeType: file.type };
  }

  const teacher = await db.user.findUnique({ where: { id: session.user.id } });

  const result = await createStudent({
    ...parsed.data,
    teacherId: session.user.id,
    labId: teacher?.labId ?? undefined,
    photo,
  });

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ id: result.id, email: result.email, password: result.password });
}
