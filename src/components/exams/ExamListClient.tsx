"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { ConfirmSheet } from "./ConfirmSheet";

export type ExamListRow = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  moduleTitle: string;
  activeQuestionCount: number;
  questionsShown: number;
  attemptsCount: number;
  passRatePercent: number | null;
  createdAt: string;
  opensAt: string | null;
  closesAt: string | null;
};

const STATUS_CHIP = {
  DRAFT: { variant: "locked" as const, label: "Draft" },
  PUBLISHED: { variant: "active" as const, label: "Published" },
  ARCHIVED: { variant: "locked" as const, label: "Archived" },
};

type StatusFilter = "ALL" | "DRAFT" | "PUBLISHED" | "ARCHIVED";
type SortBy = "date" | "title" | "status";

export function ExamListClient({ rows }: { rows: ExamListRow[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortBy, setSortBy] = useState<SortBy>("date");
  const [confirm, setConfirm] = useState<{ id: string; title: string; action: "delete" | "archive" } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visibleRows = useMemo(() => {
    const filtered = statusFilter === "ALL" ? rows : rows.filter((r) => r.status === statusFilter);
    const sorted = [...filtered];
    if (sortBy === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortBy === "status") sorted.sort((a, b) => a.status.localeCompare(b.status));
    else sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return sorted;
  }, [rows, statusFilter, sortBy]);

  async function handleDuplicate(id: string) {
    setBusyId(id);
    const res = await fetch(`/api/exams/${id}/duplicate`, { method: "POST" });
    setBusyId(null);
    if (res.ok) {
      const created = await res.json();
      router.push(`/teacher/exams/${created.id}/questions`);
    }
  }

  async function confirmAction() {
    if (!confirm) return;
    setBusyId(confirm.id);
    if (confirm.action === "delete") {
      await fetch(`/api/exams/${confirm.id}`, { method: "DELETE" });
    } else {
      await fetch(`/api/exams/${confirm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ARCHIVED" }),
      });
    }
    setBusyId(null);
    setConfirm(null);
    router.refresh();
  }

  return (
    <div>
      <div className="list-toolbar">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="ALL">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
          <option value="date">Sort: newest first</option>
          <option value="title">Sort: title</option>
          <option value="status">Sort: status</option>
        </select>
      </div>

      <div className="exam-list">
        {visibleRows.length === 0 ? (
          <Card style={{ padding: 24 }}>No exams match this filter.</Card>
        ) : (
          visibleRows.map((exam) => {
            const chip = STATUS_CHIP[exam.status];
            const bankOk = exam.activeQuestionCount >= exam.questionsShown;
            const canDelete = exam.status === "DRAFT" && exam.attemptsCount === 0;
            const busy = busyId === exam.id;
            return (
              <Card key={exam.id} className="exam-row">
                <div className="exam-row-body">
                  <div className="exam-row-title">{exam.title}</div>
                  <div className="exam-row-sub">
                    {exam.moduleTitle} · bank {exam.activeQuestionCount}/{exam.questionsShown}
                    {!bankOk ? " · under threshold" : ""}
                    {exam.passRatePercent !== null ? ` · pass rate ${exam.passRatePercent}%` : ""}
                    {exam.opensAt
                      ? ` · opens ${new Date(exam.opensAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
                      : ""}
                    {exam.closesAt
                      ? ` · closes ${new Date(exam.closesAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}`
                      : ""}
                  </div>
                </div>
                <Chip variant={chip.variant}>{chip.label}</Chip>
                <Link href={`/teacher/exams/${exam.id}/questions`} className="btn ghost">
                  Questions
                </Link>
                <Link href={`/teacher/exams/${exam.id}/preview`} className="btn ghost">
                  Preview
                </Link>
                <Link href={`/teacher/exams/${exam.id}/results`} className="btn ghost">
                  Results
                </Link>
                <Link href={`/teacher/exams/${exam.id}/edit`} className="btn ghost">
                  Edit
                </Link>
                <button className="btn ghost" disabled={busy} onClick={() => handleDuplicate(exam.id)}>
                  Duplicate
                </button>
                {exam.status !== "ARCHIVED" ? (
                  <button
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => setConfirm({ id: exam.id, title: exam.title, action: "archive" })}
                  >
                    Archive
                  </button>
                ) : null}
                {canDelete ? (
                  <button
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => setConfirm({ id: exam.id, title: exam.title, action: "delete" })}
                  >
                    Delete
                  </button>
                ) : null}
              </Card>
            );
          })
        )}
      </div>

      {confirm ? (
        <ConfirmSheet
          title={confirm.action === "delete" ? "Delete this exam?" : "Archive this exam?"}
          message={
            confirm.action === "delete"
              ? `"${confirm.title}" and its question bank will be permanently deleted. This can't be undone.`
              : `"${confirm.title}" will be hidden from students. All results and history are kept.`
          }
          confirmLabel={confirm.action === "delete" ? "Delete" : "Archive"}
          confirmVariant={confirm.action === "delete" ? "coral" : "leaf"}
          pending={busyId === confirm.id}
          onCancel={() => setConfirm(null)}
          onConfirm={confirmAction}
        />
      ) : null}
    </div>
  );
}
