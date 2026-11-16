
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/authorization";
import { Prisma } from "@/generated/prisma/client";

const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),

    search: z.string().trim().max(100).optional(),

    status: z
      .enum([
        "pending",
        "confirmed",
        "processing",
        "packed",
        "picked_up",
        "out_for_delivery",
        "delivered",
        "cancelled",
      ])
      .optional(),

    paymentStatus: z
      .enum([
        "UNPAID",
        "PENDING",
        "PAID",
        "FAILED",
        "REFUNDED",
        "PARTIALLY_REFUNDED",
      ])
      .optional(),

    paymentMethod: z.enum(["RAZORPAY", "COD"]).optional(),

    // Use "unassigned" to show orders without an outlet.
    outletId: z.string().trim().min(1).max(100).optional(),

    from: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),

    to: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine(
    (data) => !data.from || !data.to || data.from <= data.to,
    {
      message: "The start date cannot be after the end date.",
      path: ["to"],
    }
  );

function isValidCalendarDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export async function GET(request: Request) {
  // 1. Super Admin access only.
  const access = await requireSuperAdmin(["orders.read"]);

  if (!access.authorized) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status }
    );
  }

  // 2. Parse query parameters.
  const url = new URL(request.url);
  const params = url.searchParams;

  const parsed = querySchema.safeParse({
    page: params.get("page") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
    search: params.get("search") ?? undefined,
    status: params.get("status") ?? undefined,
    paymentStatus: params.get("paymentStatus") ?? undefined,
    paymentMethod: params.get("paymentMethod") ?? undefined,
    outletId: params.get("outletId") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid order filters.",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const {
    page,
    pageSize,
    search,
    status,
    paymentStatus,
    paymentMethod,
    outletId,
    from,
    to,
  } = parsed.data;

  if (
    (from && !isValidCalendarDate(from)) ||
    (to && !isValidCalendarDate(to))
  ) {
    return NextResponse.json(
      { error: "Invalid calendar date." },
      { status: 400 }
    );
  }

  // 3. Build the database filters.
  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),

    ...(paymentStatus ? { paymentStatus } : {}),

    ...(paymentMethod ? { paymentMethod } : {}),

    ...(outletId
      ? {
          outletId: outletId === "unassigned" ? null : outletId,
        }
      : {}),

    ...(search
      ? {
          OR: [
            {
              orderNumber: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              user: {
                name: {
                  contains: search,
                  mode: "insensitive",
                },
              },
            },
            {
              user: {
                phoneNumber: {
                  contains: search,
                },
              },
            },
            {
              shipName: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              shipPhone: {
                contains: search,
              },
            },
          ],
        }
      : {}),

    ...(from || to
      ? {
          createdAt: {
            ...(from
              ? {
                  gte: new Date(`${from}T00:00:00.000Z`),
                }
              : {}),
            ...(to
              ? {
                  lt: new Date(
                    new Date(`${to}T00:00:00.000Z`).getTime() +
                      24 * 60 * 60 * 1000
                  ),
                }
              : {}),
          },
        }
      : {}),
  };

  try {
    // 4. Fetch orders and total count.
    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),

      prisma.order.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * pageSize,
        take: pageSize,

        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,

          subtotalPaise: true,
          deliveryFeePaise: true,
          discountPaise: true,
          totalPaise: true,

          shipName: true,
          shipPhone: true,
          shipCity: true,
          shipPincode: true,

          createdAt: true,
          updatedAt: true,

          user: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
            },
          },

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },

          _count: {
            select: {
              items: true,
            },
          },

          deliveryAssignments: {
            where: {
              status: "ACTIVE",
            },
            take: 1,
            orderBy: {
              assignedAt: "desc",
            },
            select: {
              id: true,
              assignedAt: true,

              driverProfile: {
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
              },
            },
          },
        },
      }),
    ]);

    // 5. Return a clean dashboard response.
    const data = orders.map((order) => {
      const activeAssignment = order.deliveryAssignments[0] ?? null;

      const driverUser =
        activeAssignment?.driverProfile.staffProfile.user ?? null;

      return {
        id: order.id,
        orderNumber: order.orderNumber,

        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,

        subtotalPaise: order.subtotalPaise,
        deliveryFeePaise: order.deliveryFeePaise,
        discountPaise: order.discountPaise,
        totalPaise: order.totalPaise,

        customer: {
          id: order.user.id,
          name: order.user.name,
          phoneNumber: order.user.phoneNumber,
        },

        shipping: {
          name: order.shipName,
          phone: order.shipPhone,
          city: order.shipCity,
          pincode: order.shipPincode,
        },

        outlet: order.outlet,

        driver: activeAssignment
          ? {
              assignmentId: activeAssignment.id,
              id: activeAssignment.driverProfile.id,
              name: driverUser?.name ?? null,
              phoneNumber: driverUser?.phoneNumber ?? null,
              availability:
                activeAssignment.driverProfile.availability,
              assignedAt: activeAssignment.assignedAt,
            }
          : null,

        itemCount: order._count.items,

        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      };
    });

    return NextResponse.json({
      data,

      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Admin order listing failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve orders." },
      { status: 500 }
    );
  }
}
