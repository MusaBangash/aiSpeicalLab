"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClassSummary } from "@/lib/classes";

type Result = { id: string; email: string; password: string };

export function EnrollStudentForm({ classes }: { classes: ClassSummary[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [courseType, setCourseType] = useState("BEGINNER");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const previewUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    };
  }, []);

  function onPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    if (file) {
      const url = URL.createObjectURL(file);
      previewUrl.current = url;
      setPhotoPreview(url);
    } else {
      previewUrl.current = null;
      setPhotoPreview(null);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/students", { method: "POST", body: formData });
    setPending(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not enroll this student");
      return;
    }
    setResult(data);
  }

  if (result) {
    return (
      <div className="card" style={{ padding: 24, maxWidth: 480 }}>
        <h3 style={{ marginBottom: 12 }}>Student enrolled</h3>
        <p style={{ marginBottom: 16, color: "var(--muted)" }}>
          Write these down now — the password will not be shown again.
        </p>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 14,
            background: "var(--gold-mist)",
            borderRadius: 10,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div>Email: {result.email}</div>
          <div>Password: {result.password}</div>
        </div>
        <button className="btn" onClick={() => router.push("/teacher/students")}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 24, maxWidth: 560, display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="field">
        <label>Name</label>
        <input name="name" required disabled={pending} />
      </div>
      <div className="field">
        <label>Father&apos;s name</label>
        <input name="fatherName" required disabled={pending} />
      </div>
      <div className="field">
        <label>Contact</label>
        <input name="contact" required disabled={pending} />
      </div>
      <div className="field">
        <label>Address</label>
        <input name="address" required disabled={pending} />
      </div>
      <div className="field">
        <label>Gender</label>
        <select name="gender" required disabled={pending} defaultValue="MALE">
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div className="field">
        <label>Course type</label>
        <select name="courseType" required disabled={pending} value={courseType} onChange={(e) => setCourseType(e.target.value)}>
          <option value="BEGINNER">Beginner</option>
          <option value="INTERMEDIATE">Intermediate</option>
          <option value="ADVANCED">Advanced</option>
          <option value="DIPLOMA">Diploma</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      {courseType === "OTHER" ? (
        <div className="field">
          <label>Course type (other)</label>
          <input name="courseTypeOther" required disabled={pending} />
        </div>
      ) : null}
      <div className="field">
        <label>Category</label>
        <select name="category" required disabled={pending} defaultValue="PAYING">
          <option value="PAYING">Paying</option>
          <option value="ORPHAN">Orphan</option>
          <option value="STAFF">Staff</option>
          <option value="OTHER">Other</option>
        </select>
      </div>
      <div className="field">
        <label>Residency</label>
        <select name="residency" required disabled={pending} defaultValue="DAY_SCHOLAR">
          <option value="DAY_SCHOLAR">Day scholar</option>
          <option value="HOSTELIZED">Hostelized</option>
        </select>
      </div>
      <div className="field">
        <label>Education level</label>
        <input name="educationLevel" placeholder="e.g. Intermediate" required disabled={pending} />
      </div>
      <div className="field">
        <label>Education status</label>
        <input name="educationStatus" placeholder="e.g. Currently studying" required disabled={pending} />
      </div>
      {classes.length > 0 ? (
        <div className="field">
          <label>Assign to class (optional)</label>
          <select name="classId" disabled={pending} defaultValue="">
            <option value="">No class</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="field">
        <label>Photo (optional)</label>
        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={onPhotoChange} />
        {photoPreview ? (
          <img
            src={photoPreview}
            alt="Preview"
            style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 12, marginTop: 10 }}
          />
        ) : null}
      </div>

      {error ? <div className="field-error">{error}</div> : null}
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Enrolling…" : "Enroll student"}
      </button>
    </form>
  );
}
