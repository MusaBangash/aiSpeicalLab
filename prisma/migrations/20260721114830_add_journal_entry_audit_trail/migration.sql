-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "retractedAt" TIMESTAMP(3),
ADD COLUMN     "supersedesId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_supersedesId_key" ON "JournalEntry"("supersedesId");

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
