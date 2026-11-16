
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/authorization";
import { Prisma } from "@/generated/prisma/client";

const updateDriverSchema = z
  .object({
    isActive: z.boolean().optional(),

    // BUSY is controlled by active delivery assignments.
    availability: z.enum(["AVAILABLE", "OFFLINE"]).optional(),
  })
  .strict()
  .refine(
    (data) =>
      data.isActive !== undefined ||
      data.availability !== undefined,
    {
      message: "Provide an account status or availability change.",
    }
  );

type RouteContext = {
  params: Promise<{
    driverProfileId: string;
  }>;
};

export async function PATCH(
  request: Request,
  { params }: RouteContext
) {
  // 1. Super Admin access only.
  const access = await requireSuperAdmin(["staff.manage"]);

  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message },
      { status: access.status }
    );
  }

  const { driverProfileId } = await params;

  if (!driverProfileId || driverProfileId.length > 100) {
    return NextResponse.json(
      { success: false, error: "Invalid driver profile ID." },
      { status: 400 }
    );
  }

  // 2. Parse request body.
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const parsed = updateDriverSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid driver update details.",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // 3. Find the driver and verify the DRIVER role.
        const driver = await tx.driverProfile.findUnique({
          where: {
            id: driverProfileId,
          },

          select: {
            id: true,
            availability: true,

            staffProfile: {
              select: {
                id: true,
                isActive: true,

                role: {
                  select: {
                    name: true,
                  },
                },

                user: {
                  select: {
                    id: true,
                    name: true,
                    phoneNumber: true,
                    phoneNumberVerified: true,
                  },
                },
              },
            },
          },
        });

        if (!driver || driver.staffProfile.role.name !== "DRIVER") {
          throw new Error("DRIVER_NOT_FOUND");
        }

        // 4. Check for an active delivery assignment.
        const activeAssignment =
          await tx.deliveryAssignment.findFirst({
            where: {
              driverProfileId: driver.id,
              status: "ACTIVE",
            },
            select: {
              id: true,
              orderId: true,
              assignedAt: true,
              order: {
                select: {
                  orderNumber: true,
                  status: true,
                },
              },
            },
          });

        // 5. Calculate the requested account and availability state.
        const nextIsActive =
          parsed.data.isActive ?? driver.staffProfile.isActive;

        let nextAvailability =
          parsed.data.availability ?? driver.availability;

        // Deactivated drivers must remain offline.
        if (!nextIsActive) {
          nextAvailability = "OFFLINE";
        }

        // Reactivating an account does not automatically make
        // the driver available.
        if (
          parsed.data.isActive === true &&
          !driver.staffProfile.isActive &&
          parsed.data.availability === undefined
        ) {
          nextAvailability = "OFFLINE";
        }

        // 6. Protect drivers with active deliveries.
        if (
          activeAssignment &&
          (!nextIsActive || nextAvailability === "OFFLINE")
        ) {
          throw new Error("DRIVER_HAS_ACTIVE_ASSIGNMENT");
        }

        // 7. Only verified and active drivers can become available.
        if (nextAvailability === "AVAILABLE") {
          if (!nextIsActive) {
            throw new Error("DRIVER_ACCOUNT_INACTIVE");
          }

          if (
            driver.staffProfile.user.phoneNumberVerified !== true
          ) {
            throw new Error("DRIVER_PHONE_NOT_VERIFIED");
          }

          if (activeAssignment) {
            throw new Error("DRIVER_HAS_ACTIVE_ASSIGNMENT");
          }
        }

        const before = {
          isActive: driver.staffProfile.isActive,
          availability: driver.availability,
        };

        const after = {
          isActive: nextIsActive,
          availability: nextAvailability,
        };

        const changed =
          before.isActive !== after.isActive ||
          before.availability !== after.availability;

        // 8. Update only the fields that actually changed.
        if (changed) {
          if (before.isActive !== after.isActive) {
            await tx.staffProfile.update({
              where: {
                id: driver.staffProfile.id,
              },
              data: {
                isActive: nextIsActive,
              },
            });
          }

          if (before.availability !== after.availability) {
            await tx.driverProfile.update({
              where: {
                id: driver.id,
              },
              data: {
                availability: nextAvailability,
              },
            });
          }

          // 9. Record the change in the audit log.
          await tx.auditLog.create({
            data: {
              actorId: access.userId,
              action: "DRIVER_UPDATED",
              entity: "DriverProfile",
              entityId: driver.id,
              before,
              after,
            },
          });
        }

        return {
          changed,

          driver: {
            id: driver.id,
            name: driver.staffProfile.user.name,
            phoneNumber: driver.staffProfile.user.phoneNumber,
            phoneNumberVerified:
              driver.staffProfile.user.phoneNumberVerified === true,

            isActive: nextIsActive,
            availability: nextAvailability,
          },

          currentAssignment: activeAssignment,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return NextResponse.json({
      success: true,
      message: result.changed
        ? "Driver updated successfully."
        : "No changes were necessary.",
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<
        string,
        { status: number; message: string }
      > = {
        DRIVER_NOT_FOUND: {
          status: 404,
          message: "Driver profile not found.",
        },

        DRIVER_HAS_ACTIVE_ASSIGNMENT: {
          status: 409,
          message:
            "This driver has an active delivery. Complete or reassign it before deactivation or changing availability to OFFLINE.",
        },

        DRIVER_ACCOUNT_INACTIVE: {
          status: 409,
          message:
            "Activate the driver's account before making them available.",
        },

        DRIVER_PHONE_NOT_VERIFIED: {
          status: 409,
          message:
            "The driver must verify their mobile number before becoming available.",
        },
      };

      const knownError = errors[error.message];

      if (knownError) {
        return NextResponse.json(
          {
            success: false,
            error: knownError.message,
          },
          { status: knownError.status }
        );
      }
    }

    if (isErrorCode(error, "P2034")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The driver was updated simultaneously by another request. Please refresh and try again.",
        },
        { status: 409 }
      );
    }

    console.error("Admin driver update failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to update driver.",
      },
      { status: 500 }
    );
  }
}

function isErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}
