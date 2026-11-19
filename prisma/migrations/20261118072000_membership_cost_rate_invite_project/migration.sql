-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "assignedProjectId" TEXT;

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "hourlyCostRate" DECIMAL(12,2) NOT NULL DEFAULT 0;
