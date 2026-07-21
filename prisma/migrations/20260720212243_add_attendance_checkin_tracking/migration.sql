-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('AUTO', 'MANUAL');

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "source" "AttendanceSource" NOT NULL DEFAULT 'AUTO';
