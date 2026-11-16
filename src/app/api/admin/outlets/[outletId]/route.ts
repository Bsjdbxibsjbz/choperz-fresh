
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

type RouteContext = {
  params: Promise<{ outletId: string }>;
};

const updateOutletSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    addressLine: z.string().trim().max(250).nullable().optional(),
    city: z.string().trim().min(2).max(80).nullable().optional(),
    pincode: z.string().regex(/^\d{6}$/).nullable().optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    maxRadiusKm: z.number().positive().max(1000).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update.",
  })
  .superRefine((data, ctx) => {
    const hasLatitude = data.latitude !== undefined;
    const hasLongitude = data.longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      ctx.addIssue({
        code: "custom",
        message: "Latitude and longitude must be updated together.",
        path: ["latitude"],
      });
    }

  });

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const access = await requireStaffPermissions(["outlets.write"]);

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

    const { outletId } = await context.params;

    if (!outletId || outletId.length > 100) {
      return NextResponse.json(
        { success: false, error: "A valid outlet ID is required." },
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

    const parsed = updateOutletSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid outlet update details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updatedOutlet = await prisma.$transaction(async (tx) => {
      const existing = await tx.outlet.findUnique({
        where: { id: outletId },
      });

      if (!existing) {
        return null;
      }

      const updated = await tx.outlet.update({
        where: { id: outletId },
        data: parsed.data,
      });

      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "OUTLET_UPDATED",
          entity: "Outlet",
          entityId: outletId,
          before: {
            code: existing.code,
            name: existing.name,
            addressLine: existing.addressLine,
            city: existing.city,
            pincode: existing.pincode,
            latitude: existing.latitude,
            longitude: existing.longitude,
            maxRadiusKm: existing.maxRadiusKm,
            isActive: existing.isActive,
          },
          after: {
            code: updated.code,
            name: updated.name,
            addressLine: updated.addressLine,
            city: updated.city,
            pincode: updated.pincode,
            latitude: updated.latitude,
            longitude: updated.longitude,
            maxRadiusKm: updated.maxRadiusKm,
            isActive: updated.isActive,
          },
        },
      });

      return updated;
    });

    if (!updatedOutlet) {
      return NextResponse.json(
        { success: false, error: "Outlet not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Outlet updated successfully.",
      outlet: updatedOutlet,
    });
  } catch (error) {
    console.error("Admin outlet update error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to update outlet." },
      { status: 500 }
    );
  }
}
