-- CreateEnum
CREATE TYPE "MessageUrgency" AS ENUM ('NORMAL', 'IMPORTANT', 'URGENT');

-- CreateEnum
CREATE TYPE "MessageTargetType" AS ENUM ('STUDENT', 'CLASS', 'ALL');

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "urgency" "MessageUrgency" NOT NULL DEFAULT 'NORMAL',
    "targetType" "MessageTargetType" NOT NULL,
    "targetClassId" TEXT,
    "targetStudentId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retractedAt" TIMESTAMP(3),

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageRecipient" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "MessageRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_teacherId_idx" ON "Message"("teacherId");

-- CreateIndex
CREATE INDEX "MessageRecipient_studentId_readAt_idx" ON "MessageRecipient"("studentId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageRecipient_messageId_studentId_key" ON "MessageRecipient"("messageId", "studentId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_targetClassId_fkey" FOREIGN KEY ("targetClassId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_targetStudentId_fkey" FOREIGN KEY ("targetStudentId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRecipient" ADD CONSTRAINT "MessageRecipient_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageRecipient" ADD CONSTRAINT "MessageRecipient_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
