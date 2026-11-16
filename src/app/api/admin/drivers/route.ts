
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/authorization";
import { Prisma } from "@/generated/prisma/client";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),

  search: z.string().trim().max(100).optional(),

  availability: z
    .enum(["AVAILABLE", "BUSY", "OFFLINE"])
    .optional(),

  accountStatus: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function GET(request: Request) {
  // 1. Only Super Admin can view all drivers.
  const access = await requireSuperAdmin(["staff.manage"]);

  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message },
      { status: access.status }
    );
  }

  // 2. Validate query parameters.
  const url = new URL(request.url);

  const parsed = querySchema.safeParse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    availability:
      url.searchParams.get("availability") ?? undefined,
    accountStatus:
      url.searchParams.get("accountStatus") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid driver filters.",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const {
    page,
    pageSize,
    search,
    availability,
    accountStatus,
  } = parsed.data;

  // 3. Build filters.
  const where: Prisma.DriverProfileWhereInput = {
    ...(availability ? { availability } : {}),

    staffProfile: {
      is: {
        role: {
          is: {
            name: "DRIVER",
          },
        },

        ...(accountStatus === "ACTIVE"
          ? { isActive: true }
          : {}),

        ...(accountStatus === "INACTIVE"
          ? { isActive: false }
          : {}),

        ...(search
          ? {
              user: {
                is: {
                  OR: [
                    {
                      name: {
                        contains: search,
                        mode: "insensitive",
                      },
                    },
                    {
                      phoneNumber: {
                        contains: search,
                      },
                    },
                  ],
                },
              },
            }
          : {}),
      },
    },
  };

  try {
    // 4. Fetch driver records and total count.
    const [total, drivers] = await Promise.all([
      prisma.driverProfile.count({ where }),

      prisma.driverProfile.findMany({
        where,

        orderBy: {
          createdAt: "desc",
        },

        skip: (page - 1) * pageSize,
        take: pageSize,

        select: {
          id: true,
          availability: true,
          createdAt: true,
          updatedAt: true,

          staffProfile: {
            select: {
              id: true,
              isActive: true,
              outletId: true,

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
                  createdAt: true,
                },
              },
            },
          },

          // The database constraint guarantees at most one
          // active assignment per driver.
          assignments: {
            where: {
              status: "ACTIVE",
            },
            take: 1,
            orderBy: {
              assignedAt: "desc",
            },
            select: {
              id: true,
              orderId: true,
              assignedAt: true,

              order: {
                select: {
                  id: true,
                  orderNumber: true,
                  status: true,
                  shipName: true,
                  shipCity: true,
                  shipPincode: true,
                },
              },
            },
          },

          // Includes all historical assignment records.
          _count: {
            select: {
              assignments: true,
            },
          },
        },
      }),
    ]);

    // 5. Format driver information for the dashboard.
    const data = drivers.map((driver) => {
      const activeAssignment = driver.assignments[0] ?? null;

      const accountActive = driver.staffProfile.isActive;

      const phoneVerified =
        driver.staffProfile.user.phoneNumberVerified === true;

      const canReceiveAssignment =
        accountActive &&
        phoneVerified &&
        driver.availability === "AVAILABLE" &&
        activeAssignment === null;

      return {
        id: driver.id,

        availability: driver.availability,

        account: {
          userId: driver.staffProfile.user.id,
          staffProfileId: driver.staffProfile.id,
          name: driver.staffProfile.user.name,
          phoneNumber: driver.staffProfile.user.phoneNumber,
          phoneNumberVerified: phoneVerified,
          isActive: accountActive,
          joinedAt: driver.staffProfile.user.createdAt,
        },

        outletId: driver.staffProfile.outletId,

        currentAssignment: activeAssignment,

        assignmentCount: driver._count.assignments,

        canReceiveAssignment,

        createdAt: driver.createdAt,
        updatedAt: driver.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,

      drivers: data,

      summary: {
        total,
        available: data.filter(
          (driver) => driver.availability === "AVAILABLE"
        ).length,
        busy: data.filter(
          (driver) => driver.availability === "BUSY"
        ).length,
        offline: data.filter(
          (driver) => driver.availability === "OFFLINE"
        ).length,
        activeAccounts: data.filter(
          (driver) => driver.account.isActive
        ).length,
        inactiveAccounts: data.filter(
          (driver) => !driver.account.isActive
        ).length,
      },

      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Admin driver listing failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to retrieve drivers.",
      },
      { status: 500 }
    );
  }
}
