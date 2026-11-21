import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/customer-authorization";
import { releaseDrivers } from "@/lib/order-lifecycle";
type RouteContext = {
  params: Promise<{ orderId: string }>;
};

const cancelSchema = z.object({
  reason: z.string().trim().max(300).optional(),
}).strict();

export async function GET(_request: Request, { params }: RouteContext) {
  const access = await requireCustomer();
  if (!access.authorized) {
    return NextResponse.json({ success: false, error: access.message }, { status: access.status });
  }

  const { orderId } = await params;
  if (!orderId || orderId.length > 100) {
    return NextResponse.json({ success: false, error: "Invalid order ID." }, { status: 400 });
  }

  try {
    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: access.userId },
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
        shipLine1: true,
        shipLine2: true,
        shipLandmark: true,
        shipCity: true,
        shipPincode: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        outlet: { select: { name: true } },
        items: {
          orderBy: { productName: "asc" },
          select: {
            id: true,
            productName: true,
            variantLabel: true,
            weightGrams: true,
            quantity: true,
            unitPricePaise: true,
            cutName: true,
            cutExtraPaise: true,
            lineTotalPaise: true,
          },
        },
        history: {
          orderBy: { createdAt: "asc" },
          // Staff notes are internal and never shown to customers.
          select: { fromStatus: true, toStatus: true, createdAt: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, order });
  } catch (error) {
    console.error("Customer order detail failed:", error);
    return NextResponse.json({ success: false, error: "Unable to retrieve this order." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireCustomer();
  if (!access.authorized) {
    return NextResponse.json({ success: false, error: access.message }, { status: access.status });
  }

  const { orderId } = await params;
  if (!orderId || orderId.length > 100) {
    return NextResponse.json({ success: false, error: "Invalid order ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON request body." }, { status: 400 });
  }
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid cancellation details.", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "orders" WHERE "id" = ${orderId} AND "userId" = ${access.userId} FOR UPDATE
      `;
      if (locked.length === 0) throw new Error("ORDER_NOT_FOUND");

      const order = await tx.order.findFirst({
        where: { id: orderId, userId: access.userId },
        include: {
          items: { select: { productId: true, productName: true, weightGrams: true, quantity: true } },
          deliveryAssignments: { where: { status: "ACTIVE" }, select: { id: true, driverProfileId: true } },
        },
      });
      if (!order) throw new Error("ORDER_NOT_FOUND");
      if (order.status === "cancelled") return { alreadyCancelled: true, orderNumber: order.orderNumber };
      if (order.status !== "pending") throw new Error("CUSTOMER_CANCELLATION_CLOSED");
      if (!order.outletId) throw new Error("ORDER_OUTLET_MISSING");
      if (order.paymentStatus !== "UNPAID" && order.paymentStatus !== "FAILED") {
        throw new Error("PAYMENT_REFUND_REQUIRED");
      }

      const returns = new Map<string, { grams: number; productName: string }>();
      for (const item of order.items) {
        const current = returns.get(item.productId) ?? { grams: 0, productName: item.productName };
        current.grams += item.weightGrams * item.quantity;
        if (!Number.isSafeInteger(current.grams) || current.grams <= 0) {
          throw new Error("INVALID_RETURN_QUANTITY");
        }
        returns.set(item.productId, current);
      }

      for (const [productId, item] of [...returns.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const restored = await tx.inventory.updateMany({
          where: { outletId: order.outletId, productId },
          data: {
           onHandGrams: { increment: item.grams },
           reservedGrams: 0,
          },
        });
        if (restored.count !== 1) throw new Error("INVENTORY_RECORD_MISSING");

        await tx.stockMovement.create({
          data: {
            outletId: order.outletId,
            productId,
            type: "SALE_RETURN",
            gramsDelta: item.grams,
            orderId: order.id,
            actorId: access.userId,
            note: "Stock restored after customer cancellation of order " + order.orderNumber + ".",
          },
        });
      }

      if (order.deliveryAssignments.length > 0) {
        await tx.deliveryAssignment.updateMany({
          where: { id: { in: order.deliveryAssignments.map((assignment) => assignment.id) } },
          data: { status: "CANCELLED", completedAt: new Date(), note: parsed.data.reason ?? "Order cancelled by customer." },
        });
        await releaseDrivers(
          tx,
          order.deliveryAssignments.map((assignment) => assignment.driverProfileId)
        );
      }

      await tx.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: "cancelled",
          actorId: access.userId,
          note: parsed.data.reason ?? "Order cancelled by customer. Stock restored.",
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "CUSTOMER_ORDER_CANCELLED_STOCK_RESTORED",
          entity: "Order",
          entityId: order.id,
          before: { status: order.status, outletId: order.outletId },
          after: { status: "cancelled", restoredProductCount: returns.size },
        },
      });

      return { alreadyCancelled: false, orderNumber: order.orderNumber, restoredProductCount: returns.size };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({
      success: true,
      alreadyCancelled: result.alreadyCancelled,
      message: result.alreadyCancelled ? "This order was already cancelled." : "Order cancelled and stock restored.",
      orderNumber: result.orderNumber,
      restoredProductCount: result.restoredProductCount ?? 0,
    });
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<string, { status: number; message: string }> = {
        ORDER_NOT_FOUND: { status: 404, message: "Order not found." },
        CUSTOMER_CANCELLATION_CLOSED: { status: 409, message: "This order can no longer be cancelled online. Please contact support." },
        ORDER_OUTLET_MISSING: { status: 409, message: "This order cannot be cancelled automatically because it has no assigned outlet." },
        PAYMENT_REFUND_REQUIRED: { status: 409, message: "This order requires payment reconciliation before cancellation. Please contact support." },
        INVALID_RETURN_QUANTITY: { status: 409, message: "The order contains an invalid stock quantity." },
        INVENTORY_RECORD_MISSING: { status: 409, message: "The inventory record is missing; cancellation was rolled back." },
      };
      const known = errors[error.message];
      if (known) return NextResponse.json({ success: false, error: known.message }, { status: known.status });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ success: false, error: "The order changed during cancellation. Refresh and retry." }, { status: 409 });
    }
    console.error("Customer order cancellation failed:", error);
    return NextResponse.json({ success: false, error: "Unable to cancel this order." }, { status: 500 });
  }
}
