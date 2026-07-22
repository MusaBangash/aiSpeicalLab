-- DropForeignKey
ALTER TABLE "Exercise" DROP CONSTRAINT "Exercise_moduleId_fkey";

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "classId" TEXT,
ADD COLUMN     "targetStudentId" TEXT,
ADD COLUMN     "teacherId" TEXT NOT NULL,
ALTER COLUMN "moduleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Submission" DROP COLUMN "content",
ADD COLUMN     "attachmentMimeType" TEXT,
ADD COLUMN     "attachmentPath" TEXT,
ADD COLUMN     "body" TEXT,
ADD COLUMN     "gradedAt" TIMESTAMP(3),
ADD COLUMN     "linkUrl" TEXT;

-- CreateTable
CREATE TABLE "AssignmentItem" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "requiresSubmission" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AssignmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentItemCheck" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),

    CONSTRAINT "AssignmentItemCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssignmentItem_exerciseId_idx" ON "AssignmentItem"("exerciseId");

-- CreateIndex
CREATE INDEX "AssignmentItemCheck_studentId_idx" ON "AssignmentItemCheck"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentItemCheck_itemId_studentId_key" ON "AssignmentItemCheck"("itemId", "studentId");

-- CreateIndex
CREATE INDEX "Exercise_teacherId_idx" ON "Exercise"("teacherId");

-- CreateIndex
CREATE INDEX "Exercise_classId_idx" ON "Exercise"("classId");

-- CreateIndex
CREATE INDEX "Exercise_targetStudentId_idx" ON "Exercise"("targetStudentId");

-- CreateIndex
CREATE INDEX "Submission_studentId_idx" ON "Submission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_exerciseId_studentId_key" ON "Submission"("exerciseId", "studentId");

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CurriculumModule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Exercise" ADD CONSTRAINT "Exercise_targetStudentId_fkey" FOREIGN KEY ("targetStudentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentItem" ADD CONSTRAINT "AssignmentItem_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentItemCheck" ADD CONSTRAINT "AssignmentItemCheck_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "AssignmentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentItemCheck" ADD CONSTRAINT "AssignmentItemCheck_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

