import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireStaffPermissions, requireSuperAdmin } from "@/lib/authorization";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext
) {
  // 1. Super Admin access only.
  const access = await requireStaffPermissions(["orders.read"]);

  if (!access.authorized) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status }
    );
  }

  if (access.roleName === "OUTLET_MANAGER" && !access.outletId) {
    return NextResponse.json({ error: "Your staff account is not assigned to an outlet." }, { status: 403 });
  }

  const { orderId } = await params;

  if (!orderId || orderId.length > 100) {
    return NextResponse.json(
      { error: "Invalid order ID." },
      { status: 400 }
    );
  }

  try {
    // 2. Retrieve the complete order.
    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        ...(access.roleName === "OUTLET_MANAGER" ? { outletId: access.outletId! } : {}),
      },

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
        shipLatitude: true,
        shipLongitude: true,

        notes: true,

        createdAt: true,
        updatedAt: true,

        // Customer information.
        user: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            phoneNumberVerified: true,
          },
        },

        // Assigned outlet, if one has been selected.
        outlet: {
          select: {
            id: true,
            code: true,
            name: true,
            addressLine: true,
            city: true,
            pincode: true,
            isActive: true,
          },
        },

        // Historical product and pricing snapshots.
        items: {
          orderBy: {
            productName: "asc",
          },
          select: {
            id: true,
            productId: true,
            variantId: true,
            productName: true,
            variantLabel: true,
            weightGrams: true,
            unitPricePaise: true,
            cutName: true,
            cutExtraPaise: true,
            quantity: true,
            lineTotalPaise: true,
          },
        },

        // Complete order status timeline.
        history: {
          orderBy: {
            createdAt: "asc",
          },
          select: {
            id: true,
            fromStatus: true,
            toStatus: true,
            actorId: true,
            note: true,
            createdAt: true,
          },
        },

        // Payments and refund records.
        payments: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            provider: true,
            amountPaise: true,
            status: true,
            failureReason: true,
            razorpayOrderId: true,
            razorpayPaymentId: true,
            createdAt: true,
            updatedAt: true,

            refunds: {
              orderBy: {
                createdAt: "desc",
              },
              select: {
                id: true,
                amountPaise: true,
                status: true,
                reason: true,
                createdAt: true,
              },
            },
          },
        },

        // Current and historical driver assignments.
        deliveryAssignments: {
          orderBy: {
            assignedAt: "desc",
          },
          select: {
            id: true,
            status: true,
            assignedAt: true,
            completedAt: true,
            note: true,

            driverProfile: {
              select: {
                id: true,
                availability: true,

                staffProfile: {
                  select: {
                    isActive: true,
                    user: {
                      select: {
                        id: true,
                        name: true,
                        phoneNumber: true,
                        phoneNumberVerified: true,
                      },
                    },
                  },
                },
              },
            },

            assignedBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // 3. Return 404 if the order does not exist.
    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    // 4. Return complete order details.
    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,

        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,

        pricing: {
          subtotalPaise: order.subtotalPaise,
          deliveryFeePaise: order.deliveryFeePaise,
          discountPaise: order.discountPaise,
          totalPaise: order.totalPaise,
        },

        customer: order.user,

        shipping: {
          name: order.shipName,
          phone: order.shipPhone,
          line1: order.shipLine1,
          line2: order.shipLine2,
          landmark: order.shipLandmark,
          city: order.shipCity,
          pincode: order.shipPincode,
          latitude: order.shipLatitude,
          longitude: order.shipLongitude,
        },

        notes: order.notes,

        outlet: order.outlet,

        items: order.items,

        history: order.history,

        payments: order.payments,

        deliveryAssignments: order.deliveryAssignments,

        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    console.error("Admin order details retrieval failed:", error);

    return NextResponse.json(
      { error: "Unable to retrieve order details." },
      { status: 500 }
    );
  }
}


const cancelOrderSchema = z.object({ reason: z.string().trim().max(500).optional() }).strict();

// Super Admin cancellation restores stock in the same transaction as the status change.
export async function PATCH(request: Request, { params }: RouteContext) {
  const access = await requireSuperAdmin(["orders.update_status"]);
  if (!access.authorized) return NextResponse.json({ success: false, error: access.message }, { status: access.status });

  const { orderId } = await params;
  if (!orderId || orderId.length > 100) return NextResponse.json({ success: false, error: "Invalid order ID." }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON request body." }, { status: 400 }); }

  const parsed = cancelOrderSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid cancellation details.", details: parsed.error.flatten() }, { status: 400 });

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRawUnsafe<{ id: string; status: string }[]>(
        'SELECT "id", "status" FROM "orders" WHERE "id" = $1 FOR UPDATE', orderId
      );
      if (locked.length === 0) return { kind: "NOT_FOUND" as const };
      if (locked[0].status === "cancelled") return { kind: "ALREADY_CANCELLED" as const };
      if (locked[0].status === "delivered") return { kind: "ALREADY_DELIVERED" as const };

      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: {
          items: { select: { productId: true, productName: true, weightGrams: true, quantity: true } },
          deliveryAssignments: { where: { status: "ACTIVE" }, select: { id: true, driverProfileId: true } },
        },
      });
      if (!order) return { kind: "NOT_FOUND" as const };
      if (!order.outletId) return { kind: "OUTLET_MISSING" as const };

      const returns = new Map<string, number>();
      for (const item of order.items) {
        const grams = (returns.get(item.productId) ?? 0) + item.weightGrams * item.quantity;
        if (!Number.isSafeInteger(grams) || grams <= 0) throw new Error("INVALID_RETURN_QUANTITY");
        returns.set(item.productId, grams);
      }

      for (const [productId, grams] of [...returns.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const restored = await tx.inventory.updateMany({
          where: { outletId: order.outletId, productId },
          data: { onHandGrams: { increment: grams }, reservedGrams: 0 },
        });
        if (restored.count !== 1) throw new Error("INVENTORY_RECORD_MISSING");

        await tx.stockMovement.create({
          data: {
            outletId: order.outletId,
            productId,
            type: "SALE_RETURN",
            gramsDelta: grams,
            orderId: order.id,
            actorId: access.userId,
            note: "Stock restored because order " + order.orderNumber + " was cancelled.",
          },
        });
      }

      if (order.deliveryAssignments.length) {
        await tx.deliveryAssignment.updateMany({
          where: { id: { in: order.deliveryAssignments.map((a) => a.id) } },
          data: { status: "CANCELLED", completedAt: new Date(), note: parsed.data.reason ?? "Order cancelled by Super Admin." },
        });
        for (const driverId of [...new Set(order.deliveryAssignments.map((a) => a.driverProfileId))]) {
          const activeCount = await tx.deliveryAssignment.count({ where: { driverProfileId: driverId, status: "ACTIVE" } });
          if (activeCount === 0) await tx.driverProfile.update({ where: { id: driverId }, data: { availability: "AVAILABLE" } });
        }
      }

      await tx.order.update({ where: { id: order.id }, data: { status: "cancelled" } });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id, fromStatus: order.status, toStatus: "cancelled", actorId: access.userId,
          note: parsed.data.reason || "Order cancelled by Super Admin. Stock restored.",
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: access.userId, action: "ORDER_CANCELLED_STOCK_RESTORED", entity: "Order", entityId: order.id,
          before: { status: order.status, outletId: order.outletId },
          after: { status: "cancelled", restoredProductCount: returns.size, reason: parsed.data.reason ?? null },
        },
      });
      return { kind: "CANCELLED" as const, orderNumber: order.orderNumber, restoredProductCount: returns.size };
    }, { isolationLevel: "Serializable" });

    if (outcome.kind === "NOT_FOUND") return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    if (outcome.kind === "ALREADY_DELIVERED") return NextResponse.json({ success: false, error: "A delivered order cannot be cancelled." }, { status: 409 });
    if (outcome.kind === "OUTLET_MISSING") return NextResponse.json({ success: false, error: "The order has no assigned outlet; stock cannot be restored safely." }, { status: 409 });
    if (outcome.kind === "ALREADY_CANCELLED") return NextResponse.json({ success: true, message: "Order was already cancelled; inventory was not restored again.", alreadyCancelled: true });

    return NextResponse.json({ success: true, message: "Order cancelled and inventory restored.", orderNumber: outcome.orderNumber, restoredProductCount: outcome.restoredProductCount });
  } catch (error) {
    if (error instanceof Error && error.message === "INVENTORY_RECORD_MISSING") {
      return NextResponse.json({ success: false, error: "The order's inventory record is missing; cancellation was rolled back." }, { status: 409 });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") {
      return NextResponse.json({ success: false, error: "The order changed during cancellation. Please retry." }, { status: 409 });
    }
    console.error("Admin order cancellation failed:", error);
    return NextResponse.json({ success: false, error: "Unable to cancel order." }, { status: 500 });
  }
}
