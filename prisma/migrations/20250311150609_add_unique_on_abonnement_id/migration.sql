/*
  Warnings:

  - A unique constraint covering the columns `[id]` on the table `Abonnement` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Abonnement_id_key" ON "Abonnement"("id");
