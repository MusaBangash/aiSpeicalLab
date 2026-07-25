-- CreateEnum
CREATE TYPE "BadgeType" AS ENUM ('PERFECT_SCORE', 'EXAM_ACE', 'STREAK_7', 'STREAK_30', 'STREAK_90', 'TEAM_PLAYER', 'PROJECT_COMPLETE', 'MASTER_ENGINEER_NOMINATION');

-- CreateTable
CREATE TABLE "StudentBadge" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "BadgeType" NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awardedById" TEXT,

    CONSTRAINT "StudentBadge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentBadge_studentId_idx" ON "StudentBadge"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentBadge_studentId_type_key" ON "StudentBadge"("studentId", "type");

-- AddForeignKey
ALTER TABLE "StudentBadge" ADD CONSTRAINT "StudentBadge_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentBadge" ADD CONSTRAINT "StudentBadge_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
