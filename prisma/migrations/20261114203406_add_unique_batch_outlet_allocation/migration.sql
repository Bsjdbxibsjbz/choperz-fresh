/*
  Warnings:

  - A unique constraint covering the columns `[batchId,outletId]` on the table `batch_allocations` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "batch_allocations_batchId_outletId_key" ON "batch_allocations"("batchId", "outletId");
