-- CreateEnum
CREATE TYPE "DriverAvailability" AS ENUM ('AVAILABLE', 'BUSY', 'OFFLINE');

-- CreateEnum
CREATE TYPE "DeliveryAssignmentStatus" AS ENUM ('ACTIVE', 'REASSIGNED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "driver_profiles" (
    "id" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "availability" "DriverAvailability" NOT NULL DEFAULT 'OFFLINE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_assignments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "driverProfileId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "status" "DeliveryAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_profiles_staffProfileId_key" ON "driver_profiles"("staffProfileId");

-- CreateIndex
CREATE INDEX "delivery_assignments_orderId_status_idx" ON "delivery_assignments"("orderId", "status");

-- CreateIndex
CREATE INDEX "delivery_assignments_driverProfileId_status_idx" ON "delivery_assignments"("driverProfileId", "status");

-- CreateIndex
CREATE INDEX "delivery_assignments_assignedById_assignedAt_idx" ON "delivery_assignments"("assignedById", "assignedAt");

-- AddForeignKey
ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "staff_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_driverProfileId_fkey" FOREIGN KEY ("driverProfileId") REFERENCES "driver_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_assignments" ADD CONSTRAINT "delivery_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ensure an order has at most one active driver assignment.
CREATE UNIQUE INDEX "delivery_assignments_one_active_per_order_key"
ON "delivery_assignments" ("orderId")
WHERE "status" = 'ACTIVE';

-- Ensure a driver has at most one active assignment at a time.
CREATE UNIQUE INDEX "delivery_assignments_one_active_per_driver_key"
ON "delivery_assignments" ("driverProfileId")
WHERE "status" = 'ACTIVE';
