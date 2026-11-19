-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('PORTAL', 'CLIENT');

-- CreateEnum
CREATE TYPE "PortalProfile" AS ENUM ('PORTAL_OWNER', 'STANDARD', 'CLIENT');

-- AlterTable
ALTER TABLE "invitations" ADD COLUMN     "portalProfile" "PortalProfile" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "userType" "UserType" NOT NULL DEFAULT 'PORTAL';

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "jobTitle" TEXT,
ADD COLUMN     "portalProfile" "PortalProfile" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "userType" "UserType" NOT NULL DEFAULT 'PORTAL',
ADD COLUMN     "weeklyCapacityHours" INTEGER NOT NULL DEFAULT 40;

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_id_organizationId_key" ON "teams"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organizationId_name_key" ON "teams"("organizationId", "name");

-- CreateIndex
CREATE INDEX "team_members_organizationId_membershipId_idx" ON "team_members"("organizationId", "membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_teamId_membershipId_key" ON "team_members"("teamId", "membershipId");

-- CreateIndex
CREATE INDEX "memberships_organizationId_isActive_userType_idx" ON "memberships"("organizationId", "isActive", "userType");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_id_organizationId_key" ON "memberships"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamId_organizationId_fkey" FOREIGN KEY ("teamId", "organizationId") REFERENCES "teams"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_membershipId_organizationId_fkey" FOREIGN KEY ("membershipId", "organizationId") REFERENCES "memberships"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
