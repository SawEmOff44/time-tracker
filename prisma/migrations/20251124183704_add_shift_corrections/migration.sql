-- CreateEnum
CREATE TYPE "ShiftCorrectionType" AS ENUM ('MISSING_IN', 'MISSING_OUT', 'ADJUST_IN', 'ADJUST_OUT', 'NEW_SHIFT');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ShiftCorrectionRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "shiftId" TEXT,
    "type" "ShiftCorrectionType" NOT NULL,
    "requestedClockIn" TIMESTAMP(3),
    "requestedClockOut" TIMESTAMP(3),
    "reason" TEXT,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ShiftCorrectionRequest" ADD CONSTRAINT "ShiftCorrectionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCorrectionRequest" ADD CONSTRAINT "ShiftCorrectionRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
