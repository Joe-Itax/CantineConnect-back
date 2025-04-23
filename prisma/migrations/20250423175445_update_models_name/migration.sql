/*
  Warnings:

  - The primary key for the `Abonnement` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Abonnement` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `studentId` on the `Notification` table. All the data in the column will be lost.
  - You are about to drop the column `studentId` on the `Repas` table. All the data in the column will be lost.
  - You are about to drop the `SchoolStudent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Student` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `canteenStudentId` to the `Abonnement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `canteenStudentId` to the `Notification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `canteenStudentId` to the `Repas` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Abonnement" DROP CONSTRAINT "Abonnement_id_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Repas" DROP CONSTRAINT "Repas_studentId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_schoolStudentId_fkey";

-- DropIndex
DROP INDEX "Abonnement_id_key";

-- AlterTable
ALTER TABLE "Abonnement" DROP CONSTRAINT "Abonnement_pkey",
ADD COLUMN     "canteenStudentId" TEXT NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Abonnement_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "studentId",
ADD COLUMN     "canteenStudentId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Repas" DROP COLUMN "studentId",
ADD COLUMN     "canteenStudentId" TEXT NOT NULL;

-- DropTable
DROP TABLE "SchoolStudent";

-- DropTable
DROP TABLE "Student";

-- CreateTable
CREATE TABLE "EnrolledStudent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "isRegisteredToCanteen" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnrolledStudent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanteenStudent" (
    "id" TEXT NOT NULL,
    "enrolledStudentId" TEXT NOT NULL,
    "matriculeHashe" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CanteenStudent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnrolledStudent_matricule_key" ON "EnrolledStudent"("matricule");

-- CreateIndex
CREATE INDEX "EnrolledStudent_matricule_idx" ON "EnrolledStudent"("matricule");

-- CreateIndex
CREATE INDEX "EnrolledStudent_id_idx" ON "EnrolledStudent"("id");

-- CreateIndex
CREATE UNIQUE INDEX "CanteenStudent_enrolledStudentId_key" ON "CanteenStudent"("enrolledStudentId");

-- CreateIndex
CREATE UNIQUE INDEX "CanteenStudent_matriculeHashe_key" ON "CanteenStudent"("matriculeHashe");

-- CreateIndex
CREATE INDEX "CanteenStudent_id_idx" ON "CanteenStudent"("id");

-- CreateIndex
CREATE INDEX "CanteenStudent_enrolledStudentId_idx" ON "CanteenStudent"("enrolledStudentId");

-- CreateIndex
CREATE INDEX "CanteenStudent_matriculeHashe_idx" ON "CanteenStudent"("matriculeHashe");

-- CreateIndex
CREATE INDEX "CanteenStudent_parentId_idx" ON "CanteenStudent"("parentId");

-- AddForeignKey
ALTER TABLE "CanteenStudent" ADD CONSTRAINT "CanteenStudent_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanteenStudent" ADD CONSTRAINT "CanteenStudent_enrolledStudentId_fkey" FOREIGN KEY ("enrolledStudentId") REFERENCES "EnrolledStudent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Abonnement" ADD CONSTRAINT "Abonnement_canteenStudentId_fkey" FOREIGN KEY ("canteenStudentId") REFERENCES "CanteenStudent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Repas" ADD CONSTRAINT "Repas_canteenStudentId_fkey" FOREIGN KEY ("canteenStudentId") REFERENCES "CanteenStudent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_canteenStudentId_fkey" FOREIGN KEY ("canteenStudentId") REFERENCES "CanteenStudent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
