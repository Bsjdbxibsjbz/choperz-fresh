import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/authorization";

const collectCodSchema = z.object({
  action: z.literal("confirm_cod_cash_collected"),
  note: z.string().trim().max(500).optional(),
}).strict();

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

// POST /api/admin/orders/:orderId/payment
// This endpoint records an explicit cash-collection confirmation. Delivery
// status alone must never settle a COD payment.
export async function POST(request: Request, { params }: RouteContext) {
  const access = await requireSuperAdmin(["orders.update_status"]);
  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message },
      { status: access.status }
    );
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

  const parsed = collectCodSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid COD collection confirmation.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "orders" WHERE "id" = ${orderId} FOR UPDATE
      `;
      if (locked.length === 0) throw new Error("ORDER_NOT_FOUND");

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentMethod: true,
          paymentStatus: true,
          totalPaise: true,
        },
      });
      if (!order) throw new Error("ORDER_NOT_FOUND");
      if (order.paymentMethod !== "COD") throw new Error("NOT_COD_ORDER");
      if (order.status !== "delivered") throw new Error("ORDER_NOT_DELIVERED");
      if (order.paymentStatus === "PAID") return { alreadyPaid: true, orderNumber: order.orderNumber };
      if (order.paymentStatus !== "UNPAID") throw new Error("PAYMENT_STATE_NOT_COLLECTIBLE");

      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          provider: "cod_cash",
          amountPaise: order.totalPaise,
          status: "PAID",
        },
        select: { id: true, amountPaise: true, status: true, createdAt: true },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { paymentStatus: "PAID" },
      });

      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "COD_CASH_COLLECTION_CONFIRMED",
          entity: "Order",
          entityId: order.id,
          before: { paymentStatus: order.paymentStatus },
          after: {
            paymentStatus: "PAID",
            paymentId: payment.id,
            amountPaise: payment.amountPaise,
            note: parsed.data.note ?? null,
          },
        },
      });

      return { alreadyPaid: false, orderNumber: order.orderNumber, payment };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({
      success: true,
      message: result.alreadyPaid ? "COD payment was already recorded as paid." : "COD cash collection recorded.",
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<string, { status: number; message: string }> = {
        ORDER_NOT_FOUND: { status: 404, message: "Order not found." },
        NOT_COD_ORDER: { status: 409, message: "This order does not use Cash on Delivery." },
        ORDER_NOT_DELIVERED: { status: 409, message: "COD cash can only be recorded after delivery is marked complete." },
        PAYMENT_STATE_NOT_COLLECTIBLE: { status: 409, message: "This payment state requires payment reconciliation; cash collection was not recorded." },
      };
      const known = errors[error.message];
      if (known) return NextResponse.json({ success: false, error: known.message }, { status: known.status });
    }

    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ success: false, error: "The payment changed during collection. Refresh and retry." }, { status: 409 });
    }

    console.error("COD cash collection failed:", error);
    return NextResponse.json({ success: false, error: "Unable to record COD cash collection." }, { status: 500 });
  }
}
