-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'picked_up';

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_outletId_fkey";

-- AlterTable
ALTER TABLE "orders" ALTER COLUMN "outletId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "outlets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
