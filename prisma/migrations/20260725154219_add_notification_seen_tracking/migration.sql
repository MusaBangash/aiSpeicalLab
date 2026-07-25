-- AlterTable
ALTER TABLE "Doubt" ADD COLUMN     "studentSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StudentBadge" ADD COLUMN     "seenAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Doubt_studentId_studentSeenAt_idx" ON "Doubt"("studentId", "studentSeenAt");

-- CreateIndex
CREATE INDEX "StudentBadge_studentId_seenAt_idx" ON "StudentBadge"("studentId", "seenAt");
