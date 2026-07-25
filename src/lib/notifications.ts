/**
 * Student-facing notification center — merges three previously-independent
 * signals (messages, answered doubts, earned badges) into one chronological
 * feed + one unified nav badge. Deliberately student-facing only: Message is
 * teacher-authored one-way (teachers never receive one), and teachers already
 * have a working doubts-inbox badge, so a teacher-side notification center
 * would just be redundant.
 */
import { db } from "./db";
import { getInboxForStudent, markInboxRead, getUnreadCount } from "./messages";
import { getDoubtsForStudent } from "./doubts";
import { getBadgeShelf, BADGE_INFO } from "./badges";
import type { IconName } from "@/components/shell/Icon";

export type NotificationItem = {
  type: "message" | "doubt_answered" | "badge_earned";
  id: string;
  occurredAt: Date;
  summary: string;
  href: string;
  icon: IconName;
};

/** Full history, newest-first — never filtered by seen/unseen, same
 *  "always show everything, only the badge signals what's new" convention
 *  already used by messages/doubts. */
export async function getNotificationsForStudent(studentId: string): Promise<NotificationItem[]> {
  const [inbox, doubts, badges] = await Promise.all([
    getInboxForStudent(studentId),
    getDoubtsForStudent(studentId),
    getBadgeShelf(studentId),
  ]);

  const messageItems: NotificationItem[] = inbox.map((m) => ({
    type: "message",
    id: m.id,
    occurredAt: m.createdAt,
    summary: `${m.teacherName}: ${m.body}`,
    href: "/student/messages",
    icon: "megaphone",
  }));

  const doubtItems: NotificationItem[] = doubts
    .filter((d) => d.answeredAt !== null)
    .map((d) => ({
      type: "doubt_answered",
      id: d.id,
      occurredAt: d.answeredAt!,
      summary: `Your question about ${d.moduleTitle} was answered`,
      href: "/student/doubts",
      icon: "question",
    }));

  const badgeItems: NotificationItem[] = badges
    .filter((b) => b.earned)
    .map((b) => ({
      type: "badge_earned",
      id: b.type,
      occurredAt: b.earnedAt!,
      summary: `Earned the ${BADGE_INFO[b.type].label} badge`,
      href: "/student/progress",
      icon: b.icon,
    }));

  return [...messageItems, ...doubtItems, ...badgeItems].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}

/** Drives the unified nav badge — sum of unread messages, answered-but-unseen
 *  doubts, and earned-but-unseen badges. */
export async function getUnseenNotificationCount(studentId: string): Promise<number> {
  const [unreadMessages, unseenDoubts, unseenBadges] = await Promise.all([
    getUnreadCount(studentId),
    db.doubt.count({ where: { studentId, answeredAt: { not: null }, studentSeenAt: null } }),
    db.studentBadge.count({ where: { studentId, seenAt: null } }),
  ]);
  return unreadMessages + unseenDoubts + unseenBadges;
}

/** Bulk-marks every currently-unseen signal as seen — called once on the
 *  notifications page load, same convention as messages' markInboxRead. */
export async function markAllNotificationsSeen(studentId: string): Promise<void> {
  const now = new Date();
  await Promise.all([
    markInboxRead(studentId),
    db.doubt.updateMany({ where: { studentId, answeredAt: { not: null }, studentSeenAt: null }, data: { studentSeenAt: now } }),
    db.studentBadge.updateMany({ where: { studentId, seenAt: null }, data: { seenAt: now } }),
  ]);
}
