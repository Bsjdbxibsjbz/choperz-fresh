
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

type RouteContext = {
  params: Promise<{
    outletId: string;
    zoneId: string;
  }>;
};

const updateZoneSchema = z
  .object({
    isActive: z.boolean(),
  })
  .strict();

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const access = await requireStaffPermissions(["zones.write"]);

    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      );
    }

    if (access.roleName !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "Super Admin access required." },
        { status: 403 }
      );
    }

    const { outletId, zoneId } = await context.params;

    if (
      !outletId ||
      outletId.length > 100 ||
      !zoneId ||
      zoneId.length > 100
    ) {
      return NextResponse.json(
        { success: false, error: "Valid outlet and zone IDs are required." },
        { status: 400 }
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const parsed = updateZoneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid delivery-zone update.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.outletDeliveryZone.findFirst({
        where: {
          id: zoneId,
          outletId,
        },
      });

      if (!existing) {
        return null;
      }

      if (existing.isActive === parsed.data.isActive) {
        return {
          zone: existing,
          changed: false,
        };
      }

      const updated = await tx.outletDeliveryZone.update({
        where: { id: existing.id },
        data: {
          isActive: parsed.data.isActive,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: parsed.data.isActive
            ? "DELIVERY_ZONE_ACTIVATED"
            : "DELIVERY_ZONE_DEACTIVATED",
          entity: "OutletDeliveryZone",
          entityId: existing.id,
          before: {
            outletId,
            pincode: existing.pincode,
            isActive: existing.isActive,
          },
          after: {
            outletId,
            pincode: updated.pincode,
            isActive: updated.isActive,
            deliveryFeePaise: 0,
          },
        },
      });

      return {
        zone: updated,
        changed: true,
      };
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Delivery zone not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.changed
        ? result.zone.isActive
          ? "Delivery zone activated successfully."
          : "Delivery zone deactivated successfully."
        : "Delivery zone already has the requested status.",
      zone: {
        id: result.zone.id,
        outletId: result.zone.outletId,
        pincode: result.zone.pincode,
        isActive: result.zone.isActive,
      },
      changed: result.changed,
    });
  } catch (error) {
    console.error("Delivery zone update error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to update delivery zone." },
      { status: 500 }
    );
  }
}
