
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/authorization";

const assignDriverSchema = z
  .object({
    driverProfileId: z.string().trim().min(1).max(100),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

function isPrismaError(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

// GET: View current assignment, available drivers and history.
export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  const access = await requireSuperAdmin([
    "orders.read",
    "staff.manage",
  ]);

  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message },
      { status: access.status }
    );
  }

  const { orderId } = await params;

  if (!orderId || orderId.length > 100) {
    return NextResponse.json(
      { success: false, error: "Invalid order ID." },
      { status: 400 }
    );
  }

  try {
    const [order, availableDrivers] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          outletId: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          deliveryAssignments: {
            orderBy: {
              assignedAt: "desc",
            },
            select: {
              id: true,
              status: true,
              assignedAt: true,
              completedAt: true,
              note: true,

              driverProfile: {
                select: {
                  id: true,
                  availability: true,
                  staffProfile: {
                    select: {
                      isActive: true,
                      user: {
                        select: {
                          id: true,
                          name: true,
                          phoneNumber: true,
                        },
                      },
                    },
                  },
                },
              },

              assignedBy: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),

      prisma.driverProfile.findMany({
        where: {
          availability: "AVAILABLE",

          staffProfile: {
            is: {
              isActive: true,

              role: {
                is: {
                  name: "DRIVER",
                },
              },

              user: {
                is: {
                  phoneNumberVerified: true,
                },
              },
            },
          },

          assignments: {
            none: {
              status: "ACTIVE",
            },
          },
        },

        orderBy: {
          createdAt: "asc",
        },

        select: {
          id: true,
          availability: true,

          staffProfile: {
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  phoneNumber: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 }
      );
    }

    const currentAssignment =
      order.deliveryAssignments.find(
        (assignment) => assignment.status === "ACTIVE"
      ) ?? null;

    return NextResponse.json({
      success: true,

      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        outlet: order.outlet,
      },

      currentAssignment,

      availableDrivers: availableDrivers.map((driver) => ({
        id: driver.id,
        name: driver.staffProfile.user.name,
        phoneNumber: driver.staffProfile.user.phoneNumber,
        availability: driver.availability,
      })),

      assignmentHistory: order.deliveryAssignments,
    });
  } catch (error) {
    console.error("Get order assignment failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to retrieve driver assignment details.",
      },
      { status: 500 }
    );
  }
}

// POST: Super Admin manually assigns or reassigns a driver.
export async function POST(
  request: Request,
  { params }: RouteContext
) {
  const access = await requireSuperAdmin([
    "orders.update_status",
    "staff.manage",
  ]);

  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message },
      { status: access.status }
    );
  }

  const { orderId } = await params;

  if (!orderId || orderId.length > 100) {
    return NextResponse.json(
      { success: false, error: "Invalid order ID." },
      { status: 400 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const parsed = assignDriverSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid driver assignment details.",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { driverProfileId, note } = parsed.data;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        // Serialize assignment operations for this order.
        await tx.$queryRaw`
          SELECT "id"
          FROM "orders"
          WHERE "id" = ${orderId}
          FOR UPDATE
        `;

        const order = await tx.order.findUnique({
          where: { id: orderId },

          select: {
            id: true,
            orderNumber: true,
            outletId: true,
            status: true,

            deliveryAssignments: {
              where: {
                status: "ACTIVE",
              },
              take: 1,
              select: {
                id: true,
                driverProfileId: true,
              },
            },
          },
        });

        if (!order) {
          throw new Error("ORDER_NOT_FOUND");
        }

        if (!order.outletId) {
          throw new Error("ORDER_OUTLET_REQUIRED");
        }

        if (
          order.status === "cancelled" ||
          order.status === "delivered"
        ) {
          throw new Error("ORDER_NOT_ASSIGNABLE");
        }

        const previousAssignment =
          order.deliveryAssignments[0] ?? null;

        // Repeated assignment of the same driver is idempotent.
        if (
          previousAssignment?.driverProfileId === driverProfileId
        ) {
          return {
            changed: false,
            orderNumber: order.orderNumber,
            assignmentId: previousAssignment.id,
            driverProfileId,
            previousAssignmentId: null,
            driverName: null as string | null,
            driverPhone: null as string | null,
          };
        }

        // Lock the selected driver's row.
        await tx.$queryRaw`
          SELECT "id"
          FROM "driver_profiles"
          WHERE "id" = ${driverProfileId}
          FOR UPDATE
        `;

        const newDriver = await tx.driverProfile.findUnique({
          where: {
            id: driverProfileId,
          },

          select: {
            id: true,
            availability: true,

            staffProfile: {
              select: {
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

        if (
          !newDriver ||
          newDriver.staffProfile.role.name !== "DRIVER"
        ) {
          throw new Error("DRIVER_NOT_FOUND");
        }

        if (!newDriver.staffProfile.isActive) {
          throw new Error("DRIVER_ACCOUNT_INACTIVE");
        }

        if (
          newDriver.staffProfile.user.phoneNumberVerified !== true
        ) {
          throw new Error("DRIVER_PHONE_NOT_VERIFIED");
        }

        if (newDriver.availability !== "AVAILABLE") {
          throw new Error("DRIVER_NOT_AVAILABLE");
        }

        // Check the driver does not already have another delivery.
        const existingDriverAssignment =
          await tx.deliveryAssignment.findFirst({
            where: {
              driverProfileId,
              status: "ACTIVE",
            },
            select: {
              id: true,
              orderId: true,
            },
          });

        if (existingDriverAssignment) {
          throw new Error("DRIVER_ALREADY_ASSIGNED");
        }

        // 1. Retire the previous assignment during reassignment.
        if (previousAssignment) {
          await tx.deliveryAssignment.update({
            where: {
              id: previousAssignment.id,
            },
            data: {
              status: "REASSIGNED",
            },
          });

          // Release the previous driver's availability.
          const previousDriver =
            await tx.driverProfile.findUnique({
              where: {
                id: previousAssignment.driverProfileId,
              },
              select: {
                id: true,

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

          if (previousDriver) {
            const remainingAssignment =
              await tx.deliveryAssignment.findFirst({
                where: {
                  driverProfileId: previousDriver.id,
                  status: "ACTIVE",
                },
                select: {
                  id: true,
                },
              });

            const previousDriverAvailability =
              !previousDriver.staffProfile.isActive ||
              previousDriver.staffProfile.user
                .phoneNumberVerified !== true
                ? "OFFLINE"
                : remainingAssignment
                  ? "BUSY"
                  : "AVAILABLE";

            await tx.driverProfile.update({
              where: {
                id: previousDriver.id,
              },
              data: {
                availability: previousDriverAvailability,
              },
            });
          }
        }

        // 2. Create the new active assignment.
        const assignment = await tx.deliveryAssignment.create({
          data: {
            orderId: order.id,
            driverProfileId: newDriver.id,
            assignedById: access.userId,
            status: "ACTIVE",
            note: note ?? null,
          },

          select: {
            id: true,
            orderId: true,
            driverProfileId: true,
            status: true,
            assignedAt: true,
            note: true,
          },
        });

        // 3. The active assignment makes the driver BUSY.
        await tx.driverProfile.update({
          where: {
            id: newDriver.id,
          },
          data: {
            availability: "BUSY",
          },
        });

        // 4. Record the operation in the audit log.
        await tx.auditLog.create({
          data: {
            actorId: access.userId,

            action: previousAssignment
              ? "DRIVER_REASSIGNED"
              : "DRIVER_ASSIGNED",

            entity: "DeliveryAssignment",
            entityId: assignment.id,

            before: {
              orderId: order.id,
              previousAssignmentId:
                previousAssignment?.id ?? null,
              previousDriverProfileId:
                previousAssignment?.driverProfileId ?? null,
            },

            after: {
              orderId: order.id,
              orderNumber: order.orderNumber,
              assignmentId: assignment.id,
              driverProfileId: newDriver.id,
              driverName: newDriver.staffProfile.user.name,
              status: "ACTIVE",
            },
          },
        });

        return {
          changed: true,
          orderNumber: order.orderNumber,
          assignmentId: assignment.id,
          driverProfileId: newDriver.id,
          previousAssignmentId:
            previousAssignment?.id ?? null,
          driverName: newDriver.staffProfile.user.name,
          driverPhone: newDriver.staffProfile.user.phoneNumber,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return NextResponse.json(
      {
        success: true,

        message: result.changed
          ? result.previousAssignmentId
            ? "Driver reassigned successfully."
            : "Driver assigned successfully."
          : "This driver is already assigned to this order.",

        orderNumber: result.orderNumber,

        assignment: {
          id: result.assignmentId,
          driverProfileId: result.driverProfileId,
          driverName: result.driverName,
          driverPhone: result.driverPhone,
          status: "ACTIVE",
        },

        previousAssignmentId: result.previousAssignmentId,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<
        string,
        { status: number; message: string }
      > = {
        ORDER_NOT_FOUND: {
          status: 404,
          message: "Order not found.",
        },

        ORDER_OUTLET_REQUIRED: {
          status: 409,
          message:
            "An outlet must be confirmed before assigning a driver.",
        },

        ORDER_NOT_ASSIGNABLE: {
          status: 409,
          message:
            "Cancelled or delivered orders cannot receive a driver assignment.",
        },

        DRIVER_NOT_FOUND: {
          status: 404,
          message: "Driver profile not found.",
        },

        DRIVER_ACCOUNT_INACTIVE: {
          status: 409,
          message: "This driver's staff account is inactive.",
        },

        DRIVER_PHONE_NOT_VERIFIED: {
          status: 409,
          message:
            "The driver must verify their mobile number before receiving deliveries.",
        },

        DRIVER_NOT_AVAILABLE: {
          status: 409,
          message:
            "The selected driver is not currently available.",
        },

        DRIVER_ALREADY_ASSIGNED: {
          status: 409,
          message:
            "This driver already has another active delivery.",
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

    if (
      isPrismaError(error, "P2002") ||
      isPrismaError(error, "P2034")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The assignment changed simultaneously in another request. Refresh and try again.",
        },
        { status: 409 }
      );
    }

    console.error("Driver assignment failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to assign driver.",
      },
      { status: 500 }
    );
  }
}
