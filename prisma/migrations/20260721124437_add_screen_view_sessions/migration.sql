-- CreateTable
CREATE TABLE "ScreenViewSession" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "pcId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3),
    "saveRequestedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ScreenViewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenRecording" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenRecording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenRecordingFrame" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScreenRecordingFrame_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreenViewSession_studentId_endedAt_idx" ON "ScreenViewSession"("studentId", "endedAt");

-- CreateIndex
CREATE INDEX "ScreenViewSession_pcId_endedAt_idx" ON "ScreenViewSession"("pcId", "endedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenRecording_sessionId_key" ON "ScreenRecording"("sessionId");

-- CreateIndex
CREATE INDEX "ScreenRecording_teacherId_idx" ON "ScreenRecording"("teacherId");

-- CreateIndex
CREATE INDEX "ScreenRecordingFrame_recordingId_capturedAt_idx" ON "ScreenRecordingFrame"("recordingId", "capturedAt");

-- AddForeignKey
ALTER TABLE "ScreenViewSession" ADD CONSTRAINT "ScreenViewSession_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenViewSession" ADD CONSTRAINT "ScreenViewSession_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenViewSession" ADD CONSTRAINT "ScreenViewSession_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "PC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenRecording" ADD CONSTRAINT "ScreenRecording_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ScreenViewSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenRecording" ADD CONSTRAINT "ScreenRecording_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenRecording" ADD CONSTRAINT "ScreenRecording_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenRecordingFrame" ADD CONSTRAINT "ScreenRecordingFrame_recordingId_fkey" FOREIGN KEY ("recordingId") REFERENCES "ScreenRecording"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
