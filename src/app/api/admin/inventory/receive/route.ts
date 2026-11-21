
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

const allocationSchema = z.object({
  outletId: z.string().trim().min(1).max(100),
  grams: z.number().int().min(1).max(10_000_000),
}).strict();

const receiveStockSchema = z.object({
  batchCode: z.string().trim().min(1).max(80),
  productId: z.string().trim().min(1).max(100),
  supplierId: z.string().trim().min(1).max(100).nullable().optional(),

  receivedGrams: z.number().int().min(1).max(10_000_000),

  // Total purchase cost for this entire batch, in paise.
  costPaise: z.number().int().min(0).max(2_147_483_647).nullable().optional(),

  landingDate: z.string().datetime().nullable().optional(),
  purchaseDate: z.string().datetime().nullable().optional(),

  allocations: z.array(allocationSchema).min(1).max(20),

  note: z.string().trim().max(500).nullable().optional(),
}).strict().superRefine((data, ctx) => {
  const totalAllocated = data.allocations.reduce(
    (total, allocation) => total + allocation.grams,
    0
  );

  if (totalAllocated !== data.receivedGrams) {
    ctx.addIssue({
      code: "custom",
      path: ["allocations"],
      message: "Total allocated quantity must equal the received quantity.",
    });
  }

  const outletIds = data.allocations.map(
    (allocation) => allocation.outletId
  );

  if (new Set(outletIds).size !== outletIds.length) {
    ctx.addIssue({
      code: "custom",
      path: ["allocations"],
      message: "Each outlet can only appear once in the allocations.",
    });
  }
});

export async function POST(request: Request) {
  try {
    // 1. Authenticate and check permissions.
    const access = await requireStaffPermissions([
      "batches.write",
      "inventory.adjust",
    ]);

    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      );
    }

    // 2. Parse JSON request body.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    // 3. Validate input.
    const parsed = receiveStockSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid stock receiving details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // 4. Verify that the product is active and published.
    const product = await prisma.product.findFirst({
      where: {
        id: data.productId,
        isActive: true,
        isPlaceholder: false,
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    if (!product) {
      return NextResponse.json(
        {
          success: false,
          error: "Product not found or not available for stock receiving.",
        },
        { status: 404 }
      );
    }

    // 5. Verify the supplier if one was provided.
    if (data.supplierId) {
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: data.supplierId,
          isActive: true,
        },
        select: { id: true },
      });

      if (!supplier) {
        return NextResponse.json(
          {
            success: false,
            error: "Supplier not found or inactive.",
          },
          { status: 404 }
        );
      }
    }

    // 6. Verify all allocation outlets are active.
    const outletIds = data.allocations.map(
      (allocation) => allocation.outletId
    );

    const outlets = await prisma.outlet.findMany({
      where: {
        id: { in: outletIds },
        isActive: true,
      },
      select: { id: true },
    });

    if (outlets.length !== outletIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: "One or more outlets do not exist or are inactive.",
        },
        { status: 400 }
      );
    }

    // 7. Create batch, allocations, inventory updates,
    //    movements and audit entry in one transaction.
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.inventoryBatch.create({
        data: {
          batchCode: data.batchCode,
          productId: data.productId,
          supplierId: data.supplierId || null,
          receivedGrams: data.receivedGrams,
          costPaise: data.costPaise ?? null,
          landingDate: data.landingDate
            ? new Date(data.landingDate)
            : null,
          purchaseDate: data.purchaseDate
            ? new Date(data.purchaseDate)
            : null,
        },
      });

      for (const allocation of data.allocations) {
        // Record which outlet received this quantity.
        await tx.batchAllocation.create({
          data: {
            batchId: batch.id,
            outletId: allocation.outletId,
            grams: allocation.grams,
          },
        });

        // Increase outlet stock.
        await tx.inventory.upsert({
          where: {
            outletId_productId: {
              outletId: allocation.outletId,
              productId: data.productId,
            },
          },
          create: {
            outletId: allocation.outletId,
            productId: data.productId,
            onHandGrams: allocation.grams,
            reservedGrams: 0,
          },
          update: {
            onHandGrams: {
              increment: allocation.grams,
            },
            reservedGrams: 0,
          },
        });

        // Record the stock receipt movement.
        await tx.stockMovement.create({
          data: {
            outletId: allocation.outletId,
            productId: data.productId,
            type: "RECEIPT",
            gramsDelta: allocation.grams,
            batchId: batch.id,
            note: data.note || `Stock received: ${data.batchCode}`,
            actorId: access.userId,
          },
        });
      }

      // Audit the entire receiving transaction.
      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "STOCK_RECEIVED",
          entity: "InventoryBatch",
          entityId: batch.id,
          after: {
            batchCode: batch.batchCode,
            productId: batch.productId,
            supplierId: batch.supplierId,
            receivedGrams: batch.receivedGrams,
            costPaise: batch.costPaise,
            landingDate: batch.landingDate?.toISOString() ?? null,
            purchaseDate: batch.purchaseDate?.toISOString() ?? null,
            allocations: data.allocations.map((allocation) => ({
              outletId: allocation.outletId,
              grams: allocation.grams,
            })),
          },
        },
      });

      return batch;
    });

    // 8. Successful response.
    return NextResponse.json(
      {
        success: true,
        message: "Stock received and allocated successfully.",
        batch: {
          id: result.id,
          batchCode: result.batchCode,
          productName: product.name,
          productId: result.productId,
          supplierId: result.supplierId,
          receivedGrams: result.receivedGrams,
          costPaise: result.costPaise,
          allocations: data.allocations,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    // Duplicate batch code.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "This batch code already exists.",
        },
        { status: 409 }
      );
    }

    console.error("Stock receiving error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to receive stock.",
      },
      { status: 500 }
    );
  }
}
