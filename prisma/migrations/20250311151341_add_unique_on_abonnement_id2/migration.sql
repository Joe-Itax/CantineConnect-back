/*
  Warnings:

  - The primary key for the `Abonnement` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Abonnement` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `studentId` to the `Abonnement` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Abonnement" DROP CONSTRAINT "Abonnement_id_fkey";

-- DropIndex
DROP INDEX "Abonnement_id_key";

-- AlterTable
ALTER TABLE "Abonnement" DROP CONSTRAINT "Abonnement_pkey",
ADD COLUMN     "studentId" TEXT NOT NULL,
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Abonnement_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "Abonnement" ADD CONSTRAINT "Abonnement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
