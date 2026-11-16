
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/authorization";

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
  const access = await requireSuperAdmin(["orders.read"]);

  if (!access.authorized) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status }
    );
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
    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
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

        // Stock reservations associated with the order.
        reservations: {
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            productId: true,
            grams: true,
            status: true,
            expiresAt: true,
            createdAt: true,

            product: {
              select: {
                name: true,
                slug: true,
              },
            },

            outlet: {
              select: {
                id: true,
                code: true,
                name: true,
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

        reservations: order.reservations,

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
