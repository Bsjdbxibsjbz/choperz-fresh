import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/customer-authorization";

export async function GET() {
  try {
    const access = await requireCustomer();
    if (!access.authorized) {
      return NextResponse.json({ success: false, error: access.message }, { status: access.status });
    }

    const orders = await prisma.order.findMany({
      where: { userId: access.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
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
          select: { id: true, code: true, name: true },
        },
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
      },
    });

    return NextResponse.json({ success: true, orders });
  } catch (error) {
    console.error("Customer order history failed:", error);
    return NextResponse.json({ success: false, error: "Unable to retrieve your orders." }, { status: 500 });
  }
}
