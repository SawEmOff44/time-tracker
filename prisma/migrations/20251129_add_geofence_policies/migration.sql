-- CreateEnum
CREATE TYPE "GeofencePolicy" AS ENUM ('STRICT', 'WARN');

-- AlterTable
ALTER TABLE "Location" ADD COLUMN "geofenceRadiusMeters" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN "clockInGraceSeconds" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN "policy" "GeofencePolicy" NOT NULL DEFAULT 'STRICT';
