import { NextResponse } from "next/server";
import { requireStaffPermissions } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const access = await requireStaffPermissions(["staff.manage", "roles.manage"]);
  if (!access.authorized) {
    return NextResponse.json({ success: false, error: access.message }, { status: access.status });
  }

  try {
    const staff = await prisma.staffProfile.findMany({
      orderBy: [{ isActive: "desc" }, { user: { name: "asc" } }],
      select: {
        id: true,
        isActive: true,
        outletId: true,
        role: { select: { name: true, description: true } },
        outlet: { select: { id: true, code: true, name: true } },
        user: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            phoneNumberVerified: true,
            createdAt: true,
          },
        },
        driverProfile: {
          select: { id: true, availability: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      staff: staff.map((item) => ({
        id: item.id,
        userId: item.user.id,
        name: item.user.name,
        phoneNumber: item.user.phoneNumber,
        phoneNumberVerified: item.user.phoneNumberVerified === true,
        joinedAt: item.user.createdAt,
        isActive: item.isActive,
        role: item.role,
        outlet: item.outlet,
        driverProfile: item.driverProfile,
      })),
    });
  } catch (error) {
    console.error("Admin staff list failed:", error);
    return NextResponse.json({ success: false, error: "Unable to fetch staff directory." }, { status: 500 });
  }
}
