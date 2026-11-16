
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

const createStaffSchema = z
  .object({
    name: z.string().trim().min(2).max(100),

    phoneNumber: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{7,14}$/),

    roleName: z.enum([
      "INVENTORY_MANAGER",
      "OUTLET_MANAGER",
      "PRODUCT_MANAGER",
      "ORDER_MANAGER",
      "DRIVER",
      "CONTENT_MANAGER",
    ]),

    outletId: z.string().trim().min(1).nullable().optional(),
  })
  .strict();

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export async function POST(request: Request) {
  // 1. Require staff and role management permissions.
  const access = await requireStaffPermissions([
    "staff.manage",
    "roles.manage",
  ]);

  if (!access.authorized) {
    return NextResponse.json(
      { error: access.message },
      { status: access.status }
    );
  }

  // 2. Parse and validate the request body.
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const parsed = createStaffSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid staff details.",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { name, phoneNumber, roleName } = parsed.data;
  const outletId = parsed.data.outletId ?? null;

  // 3. Outlet Managers must have an active outlet.
  if (roleName === "OUTLET_MANAGER" && !outletId) {
    return NextResponse.json(
      { error: "An outlet is required for an Outlet Manager." },
      { status: 400 }
    );
  }

  // Only Outlet Managers receive fixed outlet assignments.
  // Drivers can be assigned deliveries from either outlet.
  if (roleName !== "OUTLET_MANAGER" && outletId) {
    return NextResponse.json(
      {
        error:
          "Only an Outlet Manager can receive an outlet assignment.",
      },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 4. Verify that the requested role exists.
      const role = await tx.role.findUnique({
        where: { name: roleName },
        select: { id: true, name: true },
      });

      if (!role) {
        throw new Error("ROLE_NOT_FOUND");
      }

      // 5. Verify that the outlet exists and is active.
      if (outletId) {
        const outlet = await tx.outlet.findFirst({
          where: {
            id: outletId,
            isActive: true,
          },
          select: { id: true },
        });

        if (!outlet) {
          throw new Error("INVALID_OUTLET");
        }
      }

      // 6. Prevent duplicate mobile accounts.
      const existingUser = await tx.user.findUnique({
        where: { phoneNumber },
        select: { id: true },
      });

      if (existingUser) {
        throw new Error("PHONE_ALREADY_REGISTERED");
      }

      // 7. Generate an internal placeholder email.
      const internalEmail =
        `${phoneNumber.replace(/\D/g, "")}@phone.choperz.invalid`;

      // 8. Create the staff user.
      const user = await tx.user.create({
        data: {
          id: randomUUID(),
          name,
          email: internalEmail,
          emailVerified: false,
          phoneNumber,
          phoneNumberVerified: false,
          kind: "STAFF",
        },
        select: {
          id: true,
          name: true,
          phoneNumber: true,
          kind: true,
        },
      });

      // 9. Create the staff profile.
      const staffProfile = await tx.staffProfile.create({
        data: {
          userId: user.id,
          roleId: role.id,
          outletId,
          isActive: true,
        },
        select: {
          id: true,
          isActive: true,
          outletId: true,
        },
      });

      // 10. Create a linked driver profile when applicable.
      // New drivers start OFFLINE and must be activated by an admin.
      const driverProfile =
        roleName === "DRIVER"
          ? await tx.driverProfile.create({
              data: {
                staffProfileId: staffProfile.id,
                availability: "OFFLINE",
              },
              select: {
                id: true,
                availability: true,
              },
            })
          : null;

      // 11. Record the administrative action.
      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "STAFF_CREATED",
          entity: "StaffProfile",
          entityId: staffProfile.id,
          after: {
            userId: user.id,
            roleName: role.name,
            outletId,
            isActive: true,
            driverProfileId: driverProfile?.id ?? null,
          },
        },
      });

      return {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        accountType: user.kind,
        staffProfileId: staffProfile.id,
        role: role.name,
        outletId: staffProfile.outletId,
        isActive: staffProfile.isActive,
        phoneNumberVerified: false,
        driverProfile: driverProfile
          ? {
              id: driverProfile.id,
              availability: driverProfile.availability,
            }
          : null,
      };
    });

    return NextResponse.json(
      {
        message:
          "Staff account created. Mobile OTP verification is pending.",
        staff: result,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ROLE_NOT_FOUND") {
        return NextResponse.json(
          { error: "Requested staff role does not exist." },
          { status: 400 }
        );
      }

      if (error.message === "INVALID_OUTLET") {
        return NextResponse.json(
          { error: "Outlet does not exist or is inactive." },
          { status: 400 }
        );
      }

      if (error.message === "PHONE_ALREADY_REGISTERED") {
        return NextResponse.json(
          { error: "This mobile number already has an account." },
          { status: 409 }
        );
      }
    }

    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: "An account with these unique details already exists." },
        { status: 409 }
      );
    }

    console.error("Staff creation failed:", error);

    return NextResponse.json(
      { error: "Unable to create staff account." },
      { status: 500 }
    );
  }
}
