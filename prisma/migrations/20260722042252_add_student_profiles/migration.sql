-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'DIPLOMA', 'OTHER');

-- CreateEnum
CREATE TYPE "StudentCategory" AS ENUM ('PAYING', 'ORPHAN', 'STAFF', 'OTHER');

-- CreateEnum
CREATE TYPE "Residency" AS ENUM ('DAY_SCHOLAR', 'HOSTELIZED');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fatherName" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "courseType" "CourseType" NOT NULL,
    "courseTypeOther" TEXT,
    "category" "StudentCategory" NOT NULL,
    "residency" "Residency" NOT NULL,
    "educationLevel" TEXT NOT NULL,
    "educationStatus" TEXT NOT NULL,
    "photoPath" TEXT,
    "photoMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
