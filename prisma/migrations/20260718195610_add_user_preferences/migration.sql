-- AlterTable
ALTER TABLE "User" ADD COLUMN     "examReminders" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showOnWall" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "streakAlerts" BOOLEAN NOT NULL DEFAULT true;
