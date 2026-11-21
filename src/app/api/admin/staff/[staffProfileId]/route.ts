import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

type RouteContext = { params: Promise<{ staffProfileId: string }> };
const schema = z.object({ isActive: z.boolean() }).strict();

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireStaffPermissions(["staff.manage", "roles.manage"]);
  if (!access.authorized) {
    return NextResponse.json({ success: false, error: access.message }, { status: access.status });
  }

  const { staffProfileId } = await context.params;
  if (!staffProfileId || staffProfileId.length > 100) {
    return NextResponse.json({ success: false, error: "A valid staff profile ID is required." }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON request body." }, { status: 400 }); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid staff status update.", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.staffProfile.findUnique({
        where: { id: staffProfileId },
        select: {
          id: true,
          isActive: true,
          role: { select: { name: true } },
          driverProfile: { select: { id: true, availability: true } },
          user: { select: { id: true, name: true, phoneNumber: true } },
        },
      });
      if (!existing) throw new Error("STAFF_NOT_FOUND");
      if (!parsed.data.isActive && existing.user.id === access.userId) throw new Error("SELF_DEACTIVATE");

      if (!parsed.data.isActive && existing.driverProfile) {
        const activeAssignments = await tx.deliveryAssignment.count({
          where: { driverProfileId: existing.driverProfile.id, status: "ACTIVE" },
        });
        if (activeAssignments > 0) throw new Error("DRIVER_HAS_ACTIVE_ASSIGNMENT");
      }

      const updated = await tx.staffProfile.update({
        where: { id: staffProfileId },
        data: { isActive: parsed.data.isActive },
        select: { id: true, isActive: true, role: { select: { name: true } }, outletId: true },
      });

      if (existing.driverProfile && !parsed.data.isActive) {
        await tx.driverProfile.update({
          where: { id: existing.driverProfile.id },
          data: { availability: "OFFLINE" },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: parsed.data.isActive ? "STAFF_ACTIVATED" : "STAFF_DEACTIVATED",
          entity: "StaffProfile",
          entityId: staffProfileId,
          before: { isActive: existing.isActive, role: existing.role.name },
          after: { isActive: updated.isActive, role: updated.role.name, userId: existing.user.id },
        },
      });
      return { ...updated, name: existing.user.name, phoneNumber: existing.user.phoneNumber };
    });

    return NextResponse.json({ success: true, message: result.isActive ? "Staff account activated." : "Staff account deactivated.", staff: result });
  } catch (error) {
    if (error instanceof Error && error.message === "STAFF_NOT_FOUND") {
      return NextResponse.json({ success: false, error: "Staff account not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "SELF_DEACTIVATE") {
      return NextResponse.json({ success: false, error: "You cannot deactivate your own staff account." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "DRIVER_HAS_ACTIVE_ASSIGNMENT") {
      return NextResponse.json({ success: false, error: "This driver has an active delivery. Reassign or complete it before deactivation." }, { status: 409 });
    }
    console.error("Admin staff update failed:", error);
    return NextResponse.json({ success: false, error: "Unable to update staff account." }, { status: 500 });
  }
}
