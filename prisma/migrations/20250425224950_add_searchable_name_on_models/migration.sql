-- AlterTable
ALTER TABLE "EnrolledStudent" ADD COLUMN     "searchableName" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "searchableName" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "EnrolledStudent_searchableName_idx" ON "EnrolledStudent"("searchableName");

-- CreateIndex
CREATE INDEX "EnrolledStudent_isRegisteredToCanteen_idx" ON "EnrolledStudent"("isRegisteredToCanteen");

-- CreateIndex
CREATE INDEX "User_searchableName_idx" ON "User"("searchableName");

-- CreateIndex
CREATE INDEX "User_id_idx" ON "User"("id");
