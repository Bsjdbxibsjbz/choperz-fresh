import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

const updateStatusSchema = z.object({
  status: z.enum([
    "confirmed",
    "processing",
    "packed",
    "picked_up",
    "out_for_delivery",
    "delivered",
  ]),
  note: z.string().trim().max(500).optional(),
}).strict();

type RouteContext = {
  params: Promise<{ orderId: string }>;
};

const allowedTransitions: Record<string, string[]> = {
  pending: ["confirmed"],
  confirmed: ["processing"],
  processing: ["packed"],
  packed: ["picked_up"],
  picked_up: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: [],
  cancelled: [],
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireStaffPermissions(["orders.update_status"]);
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

  const parsed = updateStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid order status update.", details: parsed.error.flatten() },
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
          outletId: true,
          deliveryAssignments: {
            where: { status: "ACTIVE" },
            select: { id: true, driverProfileId: true },
          },
        },
      });
      if (!order) throw new Error("ORDER_NOT_FOUND");

      if (access.roleName !== "SUPER_ADMIN" && access.roleName !== "ORDER_MANAGER" && access.outletId !== order.outletId) {
        throw new Error("ORDER_OUTLET_FORBIDDEN");
      }
      if (!order.outletId) throw new Error("ORDER_OUTLET_REQUIRED");

      const nextStatus = parsed.data.status;
      if (!allowedTransitions[order.status]?.includes(nextStatus)) {
        throw new Error("INVALID_STATUS_TRANSITION");
      }

      if (nextStatus === "out_for_delivery" && order.deliveryAssignments.length === 0) {
        throw new Error("DRIVER_ASSIGNMENT_REQUIRED");
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: nextStatus },
      });

      if (nextStatus === "delivered" && order.deliveryAssignments.length > 0) {
        const activeAssignments = order.deliveryAssignments;
        await tx.deliveryAssignment.updateMany({
          where: { id: { in: activeAssignments.map((assignment) => assignment.id) } },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            note: parsed.data.note ?? "Delivery completed.",
          },
        });

        for (const driverProfileId of [...new Set(activeAssignments.map((assignment) => assignment.driverProfileId))]) {
          const remaining = await tx.deliveryAssignment.count({
            where: { driverProfileId, status: "ACTIVE" },
          });
          if (remaining === 0) {
            const driver = await tx.driverProfile.findUnique({
              where: { id: driverProfileId },
              select: {
                staffProfile: {
                  select: {
                    isActive: true,
                    user: { select: { phoneNumberVerified: true } },
                  },
                },
              },
            });
            await tx.driverProfile.update({
              where: { id: driverProfileId },
              data: {
                availability:
                  driver?.staffProfile.isActive && driver.staffProfile.user.phoneNumberVerified
                    ? "AVAILABLE"
                    : "OFFLINE",
              },
            });
          }
        }
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: nextStatus,
          actorId: access.userId,
          note: parsed.data.note ?? null,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "ORDER_STATUS_UPDATED",
          entity: "Order",
          entityId: order.id,
          before: { status: order.status },
          after: { status: nextStatus, orderNumber: order.orderNumber },
        },
      });

      return { orderNumber: order.orderNumber, fromStatus: order.status, status: nextStatus };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({ success: true, message: "Order status updated.", order: result });
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<string, { status: number; message: string }> = {
        ORDER_NOT_FOUND: { status: 404, message: "Order not found." },
        ORDER_OUTLET_FORBIDDEN: { status: 403, message: "You can only process orders assigned to your outlet." },
        ORDER_OUTLET_REQUIRED: { status: 409, message: "An outlet must be assigned before processing this order." },
        INVALID_STATUS_TRANSITION: { status: 409, message: "This order cannot move to the requested status from its current status." },
        DRIVER_ASSIGNMENT_REQUIRED: { status: 409, message: "Assign an available driver before moving this order out for delivery." },
      };
      const known = errors[error.message];
      if (known) return NextResponse.json({ success: false, error: known.message }, { status: known.status });
    }

    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ success: false, error: "The order changed during processing. Refresh and retry." }, { status: 409 });
    }

    console.error("Order status update failed:", error);
    return NextResponse.json({ success: false, error: "Unable to update order status." }, { status: 500 });
  }
}
