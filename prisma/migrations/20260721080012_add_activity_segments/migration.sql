-- CreateTable
CREATE TABLE "ActivitySegment" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "pcId" TEXT NOT NULL,
    "appName" TEXT NOT NULL,
    "windowTitle" TEXT NOT NULL,
    "idleSeconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "ActivitySegment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivitySegment_studentId_startedAt_idx" ON "ActivitySegment"("studentId", "startedAt");

-- AddForeignKey
ALTER TABLE "ActivitySegment" ADD CONSTRAINT "ActivitySegment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivitySegment" ADD CONSTRAINT "ActivitySegment_pcId_fkey" FOREIGN KEY ("pcId") REFERENCES "PC"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
