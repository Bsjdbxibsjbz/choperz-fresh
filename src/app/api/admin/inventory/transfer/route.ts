
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

const transferSchema = z.object({
  batchId: z.string().trim().min(1).max(100),
  fromOutletId: z.string().trim().min(1).max(100),
  toOutletId: z.string().trim().min(1).max(100),
  grams: z.number().int().min(1).max(10_000_000),
  note: z.string().trim().max(500).nullable().optional(),
}).strict().superRefine((data, ctx) => {
  if (data.fromOutletId === data.toOutletId) {
    ctx.addIssue({
      code: "custom",
      path: ["toOutletId"],
      message: "Source and destination outlets must be different.",
    });
  }
});

export async function POST(request: Request) {
  try {
    // 1. Authenticate and check transfer permission.
    const access = await requireStaffPermissions([
      "inventory.transfer",
    ]);

    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      );
    }

    // 2. Parse and validate the request body.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const parsed = transferSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid stock transfer details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // 3. Staff assigned to an outlet cannot transfer
    //    stock out of another outlet.
    if (
      access.outletId &&
      data.fromOutletId !== access.outletId
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "You cannot transfer stock from another outlet.",
        },
        { status: 403 }
      );
    }

    // One reference connects both stock movements and the audit record.
    const transferRef = `TR-${randomUUID()}`;

    // 4. Perform every stock change in one transaction.
    const result = await prisma.$transaction(async (tx) => {
      // Find the batch and its product.
      const batch = await tx.inventoryBatch.findUnique({
        where: { id: data.batchId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              isActive: true,
              isPlaceholder: true,
              deletedAt: true,
            },
          },
        },
      });

      if (!batch) {
        throw new Error("BATCH_NOT_FOUND");
      }

      if (
        !batch.product.isActive ||
        batch.product.isPlaceholder ||
        batch.product.deletedAt !== null
      ) {
        throw new Error("PRODUCT_NOT_AVAILABLE");
      }

      // Confirm both outlets exist and are active.
      const outlets = await tx.outlet.findMany({
        where: {
          id: {
            in: [data.fromOutletId, data.toOutletId],
          },
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });

      if (outlets.length !== 2) {
        throw new Error("OUTLET_NOT_AVAILABLE");
      }

      const sourceOutlet = outlets.find(
        (outlet) => outlet.id === data.fromOutletId
      );

      const destinationOutlet = outlets.find(
        (outlet) => outlet.id === data.toOutletId
      );

      if (!sourceOutlet || !destinationOutlet) {
        throw new Error("OUTLET_NOT_AVAILABLE");
      }

      // Confirm the source outlet holds enough quantity
      // from this specific batch.
      const sourceAllocation =
        await tx.batchAllocation.findUnique({
          where: {
            batchId_outletId: {
              batchId: data.batchId,
              outletId: data.fromOutletId,
            },
          },
        });

      if (
        !sourceAllocation ||
        sourceAllocation.grams < data.grams
      ) {
        throw new Error("INSUFFICIENT_BATCH_ALLOCATION");
      }

      // Atomically deduct stock only when unreserved stock
      // is sufficient. This prevents transferring stock
      // already reserved for customer orders.
      const inventoryUpdated = await tx.$executeRaw`
        UPDATE "inventory"
        SET
          "onHandGrams" = "onHandGrams" - ${data.grams},
          "updatedAt" = CURRENT_TIMESTAMP
        WHERE
          "outletId" = ${data.fromOutletId}
          AND "productId" = ${batch.productId}
          AND "onHandGrams" - "reservedGrams" >= ${data.grams}
      `;

      if (inventoryUpdated !== 1) {
        throw new Error("INSUFFICIENT_AVAILABLE_STOCK");
      }

      // Atomically reduce this batch's source allocation.
      const allocationUpdated = await tx.batchAllocation.updateMany({
        where: {
          batchId: data.batchId,
          outletId: data.fromOutletId,
          grams: {
            gte: data.grams,
          },
        },
        data: {
          grams: {
            decrement: data.grams,
          },
        },
      });

      if (allocationUpdated.count !== 1) {
        throw new Error("INSUFFICIENT_BATCH_ALLOCATION");
      }

      // Remove zero-quantity source allocation records.
      await tx.batchAllocation.deleteMany({
        where: {
          batchId: data.batchId,
          outletId: data.fromOutletId,
          grams: 0,
        },
      });

      // Add this batch's quantity to the destination allocation.
      await tx.batchAllocation.upsert({
        where: {
          batchId_outletId: {
            batchId: data.batchId,
            outletId: data.toOutletId,
          },
        },
        create: {
          batchId: data.batchId,
          outletId: data.toOutletId,
          grams: data.grams,
        },
        update: {
          grams: {
            increment: data.grams,
          },
        },
      });

      // Increase the destination outlet's inventory.
      await tx.inventory.upsert({
        where: {
          outletId_productId: {
            outletId: data.toOutletId,
            productId: batch.productId,
          },
        },
        create: {
          outletId: data.toOutletId,
          productId: batch.productId,
          onHandGrams: data.grams,
          reservedGrams: 0,
        },
        update: {
          onHandGrams: {
            increment: data.grams,
          },
        },
      });

      const movementNote =
        data.note ||
        `Stock transfer ${transferRef}: ${sourceOutlet.code} to ${destinationOutlet.code}`;

      // Record the source deduction.
      await tx.stockMovement.create({
        data: {
          outletId: data.fromOutletId,
          productId: batch.productId,
          type: "TRANSFER_OUT",
          gramsDelta: -data.grams,
          batchId: batch.id,
          note: movementNote,
          actorId: access.userId,
        },
      });

      // Record the destination receipt.
      await tx.stockMovement.create({
        data: {
          outletId: data.toOutletId,
          productId: batch.productId,
          type: "TRANSFER_IN",
          gramsDelta: data.grams,
          batchId: batch.id,
          note: movementNote,
          actorId: access.userId,
        },
      });

      // Record the complete transfer in the audit log.
      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "STOCK_TRANSFERRED",
          entity: "InventoryTransfer",
          entityId: transferRef,
          after: {
            transferRef,
            batchId: batch.id,
            batchCode: batch.batchCode,
            productId: batch.productId,
            productName: batch.product.name,
            fromOutletId: data.fromOutletId,
            fromOutletName: sourceOutlet.name,
            toOutletId: data.toOutletId,
            toOutletName: destinationOutlet.name,
            grams: data.grams,
            note: data.note || null,
          },
        },
      });

      return {
        transferRef,
        batchId: batch.id,
        batchCode: batch.batchCode,
        productId: batch.productId,
        productName: batch.product.name,
        fromOutlet: sourceOutlet,
        toOutlet: destinationOutlet,
        gramsTransferred: data.grams,
      };
    });

    // 5. Return success.
    return NextResponse.json(
      {
        success: true,
        message: "Stock transferred successfully.",
        transfer: result,
      },
      { status: 201 }
    );
  } catch (error) {
    // Handle expected business-rule failures.
    const knownErrors: Record<string, { status: number; message: string }> = {
      BATCH_NOT_FOUND: {
        status: 404,
        message: "Inventory batch not found.",
      },
      PRODUCT_NOT_AVAILABLE: {
        status: 400,
        message: "This product is inactive or unavailable.",
      },
      OUTLET_NOT_AVAILABLE: {
        status: 400,
        message: "One or both outlets do not exist or are inactive.",
      },
      INSUFFICIENT_BATCH_ALLOCATION: {
        status: 409,
        message: "The source outlet does not have enough stock from this batch.",
      },
      INSUFFICIENT_AVAILABLE_STOCK: {
        status: 409,
        message: "Insufficient available stock. Some stock may be reserved for orders.",
      },
    };

    if (error instanceof Error && knownErrors[error.message]) {
      const known = knownErrors[error.message];

      return NextResponse.json(
        { success: false, error: known.message },
        { status: known.status }
      );
    }

    console.error("Stock transfer error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to transfer stock.",
      },
      { status: 500 }
    );
  }
}
