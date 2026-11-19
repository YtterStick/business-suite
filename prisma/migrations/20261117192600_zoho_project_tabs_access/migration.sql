-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "businessHours" TEXT NOT NULL DEFAULT 'Standard Business Hours',
ADD COLUMN     "enabledTabs" TEXT[] DEFAULT ARRAY['Dashboard', 'Tasks', 'Users', 'Reports', 'Documents', 'Phases', 'Time Logs', 'Bugs', 'Feed', 'Timesheet']::TEXT[],
ADD COLUMN     "taskLayout" TEXT NOT NULL DEFAULT 'Standard Layout';
