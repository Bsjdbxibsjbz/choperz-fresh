
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

const querySchema = z.object({
  outletId: z.string().trim().min(1).max(100).optional(),
  productId: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: Request) {
  try {
    // 1. Authenticate and check inventory permission.
    const access = await requireStaffPermissions([
      "inventory.read",
    ]);

    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      );
    }

    const isSuperAdmin = access.roleName === "SUPER_ADMIN";
    const isOutletManager = access.roleName === "OUTLET_MANAGER";

    // 2. Outlet Managers must have an assigned outlet.
    if (isOutletManager && !access.outletId) {
      return NextResponse.json(
        {
          success: false,
          error: "No outlet is assigned to this staff account.",
        },
        { status: 403 }
      );
    }

    // 3. Validate query parameters.
    const url = new URL(request.url);

    const parsed = querySchema.safeParse({
      outletId: url.searchParams.get("outletId") || undefined,
      productId: url.searchParams.get("productId") || undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid inventory query parameters.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { outletId, productId, page, limit } = parsed.data;

    // 4. Restrict Outlet Managers to their assigned outlet.
    if (
      isOutletManager &&
      outletId &&
      outletId !== access.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You cannot access another outlet's inventory.",
        },
        { status: 403 }
      );
    }

    const selectedOutletId = isOutletManager
      ? access.outletId!
      : outletId;

    // 5. Build inventory filters.
    // Super Admin can see placeholder and inactive product records.
    // Other permitted staff only see active, published products.
    const where = {
      ...(selectedOutletId ? { outletId: selectedOutletId } : {}),
      ...(productId ? { productId } : {}),

      outlet: {
        isActive: true,
      },

      product: {
        ...(isSuperAdmin
          ? {}
          : {
              isActive: true,
              isPlaceholder: false,
              deletedAt: null,
            }),
      },
    };

    // 6. Fetch inventory records and total count.
    const [inventory, total] = await prisma.$transaction([
      prisma.inventory.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { outlet: { name: "asc" } },
          { product: { name: "asc" } },
        ],
        select: {
          id: true,
          onHandGrams: true,
          reservedGrams: true,
          updatedAt: true,

          outlet: {
            select: {
              id: true,
              code: true,
              name: true,
              city: true,
            },
          },

          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              isPlaceholder: true,
              isActive: true,
            },
          },
        },
      }),

      prisma.inventory.count({ where }),
    ]);

    // 7. Calculate available stock.
    const records = inventory.map((item) => {
      const availableGrams =
        item.onHandGrams - item.reservedGrams;

      return {
        id: item.id,

        outlet: item.outlet,

        product: item.product,

        stock: {
          onHandGrams: item.onHandGrams,
          reservedGrams: item.reservedGrams,
          availableGrams,

          // This is an alert, not a stock adjustment.
          hasStockIssue:
            item.onHandGrams < 0 ||
            item.reservedGrams < 0 ||
            availableGrams < 0,
        },

        updatedAt: item.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,

      access: {
        role: access.roleName,
        outletId: isOutletManager
          ? access.outletId
          : null,
      },

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },

      inventory: records,
    });
  } catch (error) {
    console.error("Inventory API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to fetch inventory.",
      },
      { status: 500 }
    );
  }
}
