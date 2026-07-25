-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "moduleId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordResetAt" TIMESTAMP(3),
ADD COLUMN     "passwordResetById" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_passwordResetById_fkey" FOREIGN KEY ("passwordResetById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "CurriculumModule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
