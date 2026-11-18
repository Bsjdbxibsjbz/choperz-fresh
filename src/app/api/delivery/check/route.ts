import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  pincode: z.string().trim().regex(/^\d{6}$/),
});

// GET /api/delivery/check?pincode=570001
//
// Public, pincode-only check: is the pincode inside an active delivery zone of
// an active outlet? It lets the storefront warn a customer early.
//
// `covered: true` does NOT guarantee the order will be accepted. Checkout still
// applies the exact delivery address (GPS), the outlet's maximum radius and
// stock before it assigns an outlet. The response reveals no outlet details.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({
    pincode: searchParams.get("pincode") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Enter a valid 6-digit pincode." },
      { status: 400 }
    );
  }

  const { pincode } = parsed.data;

  try {
    const zone = await prisma.outletDeliveryZone.findFirst({
      where: {
        pincode,
        isActive: true,
        outlet: { is: { isActive: true } },
      },
      select: { id: true },
    });

    return NextResponse.json(
      { success: true, pincode, covered: zone !== null },
      // Admins can change zones at any time.
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Pincode check failed:", error);
    return NextResponse.json(
      { success: false, error: "Unable to check delivery availability." },
      { status: 500 }
    );
  }
}
