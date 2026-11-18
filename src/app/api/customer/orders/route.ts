import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/customer-authorization";

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
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
});

// GET /api/customer/orders?page=1&limit=10&status=pending
// Lists the signed-in customer's own orders, newest first. Each order carries
// a short item preview; the full item list is on the order detail endpoint.
export async function GET(request: Request) {
  try {
    const access = await requireCustomer();
    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      );
    }

    const { searchParams } = new URL(request.url);
    const parsed = listQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid order list query.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { page, limit, status } = parsed.data;

    const where = {
      userId: access.userId,
      ...(status ? { status } : {}),
    };

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
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
          shipCity: true,
          shipPincode: true,
          createdAt: true,
          updatedAt: true,
          outlet: {
            select: { name: true },
          },
          _count: {
            select: { items: true },
          },
          items: {
            orderBy: { productName: "asc" },
            take: 3,
            select: {
              productName: true,
              variantLabel: true,
              quantity: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      orders: orders.map(({ _count, items, ...order }) => ({
        ...order,
        itemCount: _count.items,
        itemsPreview: items,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error("Customer order history failed:", error);
    return NextResponse.json(
      { success: false, error: "Unable to retrieve your orders." },
      { status: 500 }
    );
  }
}
