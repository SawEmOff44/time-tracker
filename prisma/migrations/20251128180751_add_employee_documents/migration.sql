/*
  Warnings:

  - You are about to drop the column `fileUrl` on the `EmployeeDocument` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `EmployeeDocument` table. All the data in the column will be lost.
  - You are about to drop the column `uploadedByAdmin` on the `EmployeeDocument` table. All the data in the column will be lost.
  - Added the required column `title` to the `EmployeeDocument` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `EmployeeDocument` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EmployeeDocument" DROP COLUMN "fileUrl",
DROP COLUMN "name",
DROP COLUMN "uploadedByAdmin",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "url" TEXT NOT NULL;
