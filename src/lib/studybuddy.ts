/** Teacher-facing study-buddy pairing suggestions — suggestion-only, no
 *  automated matching or student notification. Composed purely from
 *  already-existing exam-attempt data, no new schema. Leaf-only module:
 *  nothing else in src/lib/ imports from this file, only the class
 *  detail page does. */
import { getTopicBreakdownByStudent } from "./exam";
import { MIN_TOPIC_SAMPLE_SIZE } from "./dna";
import type { RosterEntry } from "./classes";

export type StudyBuddySuggestion = {
  studentId: string;
  studentName: string;
  weakTopic: string;
  weakPercent: number;
  partnerId: string;
  partnerName: string;
  partnerPercent: number;
};

/** For each roster student whose weakest topic clears the sample-size
 *  floor, suggests the classmate scoring highest on that EXACT topic
 *  (also clearing the floor) as a one-directional tutor match. A
 *  student with no qualifying weak topic, or no classmate who
 *  qualifies on it, is simply omitted — never padded with a
 *  low-confidence guess. */
export async function getStudyBuddySuggestions(roster: RosterEntry[]): Promise<StudyBuddySuggestion[]> {
  if (roster.length < 2) return [];

  const studentIds = roster.map((r) => r.studentId);
  const nameById = new Map(roster.map((r) => [r.studentId, r.name]));
  const breakdownByStudent = await getTopicBreakdownByStudent(studentIds);

  const suggestions: StudyBuddySuggestion[] = [];
  for (const studentId of studentIds) {
    const rows = breakdownByStudent.get(studentId) ?? [];
    const weakRow = rows.find((r) => r.totalCount >= MIN_TOPIC_SAMPLE_SIZE);
    if (!weakRow) continue;

    let bestPartner: { id: string; percent: number } | null = null;
    for (const otherId of studentIds) {
      if (otherId === studentId) continue;
      const otherRow = (breakdownByStudent.get(otherId) ?? []).find(
        (r) => r.moduleId === weakRow.moduleId && r.totalCount >= MIN_TOPIC_SAMPLE_SIZE
      );
      if (!otherRow || otherRow.percentCorrect <= weakRow.percentCorrect) continue;
      if (!bestPartner || otherRow.percentCorrect > bestPartner.percent) {
        bestPartner = { id: otherId, percent: otherRow.percentCorrect };
      }
    }
    if (!bestPartner) continue;

    suggestions.push({
      studentId,
      studentName: nameById.get(studentId) ?? "Student",
      weakTopic: weakRow.moduleTitle,
      weakPercent: weakRow.percentCorrect,
      partnerId: bestPartner.id,
      partnerName: nameById.get(bestPartner.id) ?? "Student",
      partnerPercent: bestPartner.percent,
    });
  }

  return suggestions.sort((a, b) => a.weakPercent - b.weakPercent);
}
