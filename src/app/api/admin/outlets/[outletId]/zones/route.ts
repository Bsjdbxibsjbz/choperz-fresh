
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

type RouteContext = {
  params: Promise<{ outletId: string }>;
};

const createZoneSchema = z
  .object({
    pincode: z.string().trim().regex(/^\d{6}$/),
  })
  .strict();

async function authorizeSuperAdmin() {
  const access = await requireStaffPermissions(["zones.write"]);

  if (!access.authorized) {
    return {
      authorized: false as const,
      response: NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      ),
    };
  }

  if (access.roleName !== "SUPER_ADMIN") {
    return {
      authorized: false as const,
      response: NextResponse.json(
        { success: false, error: "Super Admin access required." },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true as const,
    userId: access.userId,
  };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

// GET: List active and inactive delivery zones for an outlet.
export async function GET(
  _request: Request,
  context: RouteContext
) {
  try {
    const authorization = await authorizeSuperAdmin();

    if (!authorization.authorized) {
      return authorization.response;
    }

    const { outletId } = await context.params;

    const outlet = await prisma.outlet.findUnique({
      where: { id: outletId },
      select: {
        id: true,
        code: true,
        name: true,
        isActive: true,
      },
    });

    if (!outlet) {
      return NextResponse.json(
        { success: false, error: "Outlet not found." },
        { status: 404 }
      );
    }

    const zones = await prisma.outletDeliveryZone.findMany({
      where: { outletId },
      orderBy: { pincode: "asc" },
      select: {
        id: true,
        pincode: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      outlet,
      count: zones.length,
      activeCount: zones.filter((zone) => zone.isActive).length,
      inactiveCount: zones.filter((zone) => !zone.isActive).length,
      freeDelivery: true,
      zones,
    });
  } catch (error) {
    console.error("Delivery zone list error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to fetch delivery zones." },
      { status: 500 }
    );
  }
}

// POST: Create a serviceable pincode or reactivate an existing one.
export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const authorization = await authorizeSuperAdmin();

    if (!authorization.authorized) {
      return authorization.response;
    }

    const { outletId } = await context.params;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request body." },
        { status: 400 }
      );
    }

    const parsed = createZoneSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid delivery zone details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { pincode } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const outlet = await tx.outlet.findUnique({
        where: { id: outletId },
        select: {
          id: true,
          code: true,
          name: true,
        },
      });

      if (!outlet) {
        return { kind: "outlet-not-found" as const };
      }

      const existing = await tx.outletDeliveryZone.findUnique({
        where: {
          outletId_pincode: {
            outletId,
            pincode,
          },
        },
      });

      if (existing?.isActive) {
        return {
          kind: "already-active" as const,
          zone: existing,
        };
      }

      if (existing) {
        const updated = await tx.outletDeliveryZone.update({
          where: { id: existing.id },
          data: { isActive: true },
        });

        await tx.auditLog.create({
          data: {
            actorId: authorization.userId,
            action: "DELIVERY_ZONE_ACTIVATED",
            entity: "OutletDeliveryZone",
            entityId: updated.id,
            before: {
              outletId,
              pincode: existing.pincode,
              isActive: false,
            },
            after: {
              outletId,
              pincode: updated.pincode,
              isActive: true,
              freeDelivery: true,
            },
          },
        });

        return {
          kind: "reactivated" as const,
          zone: updated,
        };
      }

      const created = await tx.outletDeliveryZone.create({
        data: {
          outletId,
          pincode,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: authorization.userId,
          action: "DELIVERY_ZONE_CREATED",
          entity: "OutletDeliveryZone",
          entityId: created.id,
          after: {
            outletId,
            outletCode: outlet.code,
            pincode: created.pincode,
            isActive: true,
            freeDelivery: true,
          },
        },
      });

      return {
        kind: "created" as const,
        zone: created,
      };
    });

    if (result.kind === "outlet-not-found") {
      return NextResponse.json(
        { success: false, error: "Outlet not found." },
        { status: 404 }
      );
    }

    if (result.kind === "already-active") {
      return NextResponse.json(
        {
          success: false,
          error: "This pincode is already active for this outlet.",
          zone: result.zone,
        },
        { status: 409 }
      );
    }

    const reactivated = result.kind === "reactivated";

    return NextResponse.json(
      {
        success: true,
        message: reactivated
          ? "Delivery zone reactivated successfully."
          : "Serviceable pincode added successfully. Delivery is free.",
        zone: {
          id: result.zone.id,
          pincode: result.zone.pincode,
          isActive: result.zone.isActive,
        },
        deliveryFeePaise: 0,
      },
      { status: reactivated ? 200 : 201 }
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        {
          success: false,
          error: "This pincode was added concurrently. Refresh and check its status.",
        },
        { status: 409 }
      );
    }

    console.error("Delivery zone creation error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to save delivery zone." },
      { status: 500 }
    );
  }
}
