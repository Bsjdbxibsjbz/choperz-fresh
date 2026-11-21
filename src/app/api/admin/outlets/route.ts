
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

const createOutletSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(30)
      .regex(/^[A-Za-z0-9_-]+$/)
      .transform((value) => value.toUpperCase()),

    name: z.string().trim().min(2).max(120),
    addressLine: z.string().trim().max(250).nullable().optional(),
    city: z.string().trim().min(2).max(80),
    pincode: z
      .string()
      .trim()
      .regex(/^\d{6}$/)
      .nullable()
      .optional(),

    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    maxRadiusKm: z.number().positive().max(1000).nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
;

async function requireSuperAdmin() {
  const access = await requireStaffPermissions(["outlets.write"]);

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

  return { authorized: true as const, access };
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

// GET: List all outlets and their configured delivery zones.
export async function GET() {
  try {
    const authorization = await requireSuperAdmin();

    if (!authorization.authorized) {
      return authorization.response;
    }

    const outlets = await prisma.outlet.findMany({
      orderBy: [{ name: "asc" }, { code: "asc" }],
      include: {
        zones: {
          orderBy: { pincode: "asc" },
          select: {
            id: true,
            pincode: true,
            deliveryFeePaise: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      count: outlets.length,
      outlets,
    });
  } catch (error) {
    console.error("Admin outlet list error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to fetch outlets." },
      { status: 500 }
    );
  }
}

// POST: Register a new outlet.
export async function POST(request: Request) {
  try {
    const authorization = await requireSuperAdmin();

    if (!authorization.authorized) {
      return authorization.response;
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

    const parsed = createOutletSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid outlet details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const outlet = await prisma.$transaction(async (tx) => {
      const created = await tx.outlet.create({
        data: {
          code: data.code,
          name: data.name,
          addressLine: data.addressLine ?? null,
          city: data.city,
          pincode: data.pincode ?? null,
          latitude: data.latitude,
          longitude: data.longitude,
          maxRadiusKm: data.maxRadiusKm ?? null,
          isActive: data.isActive,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: authorization.access.userId,
          action: "OUTLET_CREATED",
          entity: "Outlet",
          entityId: created.id,
          after: {
            code: created.code,
            name: created.name,
            addressLine: created.addressLine,
            city: created.city,
            pincode: created.pincode,
            latitude: created.latitude,
            longitude: created.longitude,
            maxRadiusKm: created.maxRadiusKm,
            isActive: created.isActive,
          },
        },
      });

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Outlet created successfully.",
        outlet,
      },
      { status: 201 }
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { success: false, error: "An outlet with this code already exists." },
        { status: 409 }
      );
    }

    console.error("Admin outlet creation error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to create outlet." },
      { status: 500 }
    );
  }
}
