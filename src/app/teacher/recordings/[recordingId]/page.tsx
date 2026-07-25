/** Teacher: playback of one saved screen recording — only its own capturing teacher can view it. */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getRecordingWithFrames, RECORDING_RETENTION_DAYS } from "@/lib/screenView";
import { PageHeader } from "@/components/shell/PageHeader";
import { RecordingSlideshow } from "@/components/screenview/RecordingSlideshow";

export default async function RecordingDetailPage({
  params,
}: {
  params: Promise<{ recordingId: string }>;
}) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") redirect("/login");

  const { recordingId } = await params;
  const recording = await getRecordingWithFrames(session.user.id, recordingId);
  if (!recording) redirect("/teacher/students");

  const student = await db.user.findUnique({ where: { id: recording.studentId } });

  return (
    <div className="page-anim">
      <PageHeader title={`Recording — ${student?.name ?? "Unknown student"}`} />
      <div style={{ marginBottom: 16, color: "var(--muted)", fontSize: 13 }}>
        Saved {recording.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })} ·{" "}
        {recording.frames.length} frames · auto-deleted after {RECORDING_RETENTION_DAYS} days
      </div>
      <RecordingSlideshow
        recordingId={recording.id}
        frames={recording.frames.map((f) => ({ id: f.id, capturedAt: f.capturedAt.toISOString() }))}
      />
    </div>
  );
}
