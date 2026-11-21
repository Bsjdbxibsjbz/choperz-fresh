
import { connection, NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

const querySchema = z.object({
  search: z.string().trim().min(1).max(100).optional(),
  outletId: z.string().trim().min(1).max(100).optional(),
  productId: z.string().trim().min(1).max(100).optional(),
  supplierId: z.string().trim().min(1).max(100).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
}).superRefine((data, ctx) => {
  if (data.from && data.to && new Date(data.from) > new Date(data.to)) {
    ctx.addIssue({
      code: "custom",
      path: ["to"],
      message: "The end date must be after the start date.",
    });
  }
});

export async function GET(request: Request) {
  await connection();

  try {
    // 1. Authenticate and check inventory access.
    const access = await requireStaffPermissions(["inventory.read"]);

    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      );
    }

    const isOutletManager = access.roleName === "OUTLET_MANAGER";

    if (isOutletManager && !access.outletId) {
      return NextResponse.json(
        {
          success: false,
          error: "No outlet is assigned to this staff account.",
        },
        { status: 403 }
      );
    }

    // 2. Validate query parameters.
    const url = new URL(request.url);

    const parsed = querySchema.safeParse({
      search: url.searchParams.get("search") || undefined,
      outletId: url.searchParams.get("outletId") || undefined,
      productId: url.searchParams.get("productId") || undefined,
      supplierId: url.searchParams.get("supplierId") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid batch history query.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      search,
      outletId,
      productId,
      supplierId,
      from,
      to,
      page,
      limit,
    } = parsed.data;

    // 3. Restrict Outlet Managers to their own outlet.
    if (
      isOutletManager &&
      outletId &&
      outletId !== access.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You cannot access another outlet's batch history.",
        },
        { status: 403 }
      );
    }

    const selectedOutletId = isOutletManager
      ? access.outletId!
      : outletId;

    // 4. Build filters.
    const where = {
      ...(productId ? { productId } : {}),
      ...(supplierId ? { supplierId } : {}),

      ...(selectedOutletId
        ? {
            allocations: {
              some: {
                outletId: selectedOutletId,
              },
            },
          }
        : {}),

      ...(search
        ? {
            OR: [
              {
                batchCode: {
                  contains: search,
                  mode: "insensitive" as const,
                },
              },
              {
                product: {
                  name: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
              },
              {
                supplier: {
                  is: {
                    name: {
                      contains: search,
                      mode: "insensitive" as const,
                    },
                  },
                },
              },
            ],
          }
        : {}),

      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    // 5. Fetch batch history and pagination count.
    const [total, batches] = await prisma.$transaction([
      prisma.inventoryBatch.count({ where }),

      prisma.inventoryBatch.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,

        include: {
          product: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },

          supplier: {
            select: {
              id: true,
              name: true,
              location: true,
              contact: true,
            },
          },

          allocations: {
            where: selectedOutletId
              ? { outletId: selectedOutletId }
              : {},
            include: {
              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  city: true,
                },
              },
            },
          },

          movements: {
            where: selectedOutletId
              ? { outletId: selectedOutletId }
              : {},
            orderBy: {
              createdAt: "desc",
            },
            take: 25,
            include: {
              outlet: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // 6. Calculate the quantities visible to this staff account.
    const result = batches.map((batch) => {
      const visibleAllocatedGrams = batch.allocations.reduce(
        (total, allocation) => total + allocation.grams,
        0
      );

      return {
        ...batch,
        visibleAllocatedGrams,
        recentMovements: batch.movements,
      };
    });

    // 7. Return batch history.
    return NextResponse.json({
      success: true,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      batches: result,
    });
  } catch (error) {
    console.error("Batch history error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to fetch batch history.",
      },
      { status: 500 }
    );
  }
}
