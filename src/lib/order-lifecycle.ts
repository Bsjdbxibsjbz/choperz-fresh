import type { Prisma } from "@/generated/prisma/client";

// After a delivery assignment ends (delivered, cancelled or reassigned),
// put the driver back into the correct availability state:
// - OFFLINE if the driver's staff account is inactive or phone is unverified
// - BUSY if the driver still has another active assignment
// - AVAILABLE otherwise
//
// Every code path that closes an assignment must use this helper
// so drivers are never released inconsistently.

export async function releaseDriver(
  tx: Prisma.TransactionClient,
  driverProfileId: string
): Promise<void> {
  const driver = await tx.driverProfile.findUnique({
    where: { id: driverProfileId },
    select: {
      staffProfile: {
        select: {
          isActive: true,
          user: {
            select: {
              phoneNumberVerified: true,
            },
          },
        },
      },
    },
  });

  if (!driver) {
    return;
  }

  const remainingAssignment = await tx.deliveryAssignment.findFirst({
    where: {
      driverProfileId,
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  const availability =
    !driver.staffProfile.isActive ||
    driver.staffProfile.user.phoneNumberVerified !== true
      ? "OFFLINE"
      : remainingAssignment
        ? "BUSY"
        : "AVAILABLE";

  await tx.driverProfile.update({
    where: { id: driverProfileId },
    data: { availability },
  });
}

// Release every distinct driver from a list of just-closed assignments.

export async function releaseDrivers(
  tx: Prisma.TransactionClient,
  driverProfileIds: readonly string[]
): Promise<void> {
  for (const driverProfileId of new Set(driverProfileIds)) {
    await releaseDriver(tx, driverProfileId);
  }
}