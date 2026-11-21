
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

const createSupplierSchema = z.object({
  name: z.string().trim().min(2).max(120),
  location: z.string().trim().max(200).nullable().optional(),
  contact: z.string().trim().max(100).nullable().optional(),
}).strict();

// GET: List registered suppliers.
export async function GET() {
  try {
    const access = await requireStaffPermissions([
      "suppliers.write",
    ]);

    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      );
    }

    const suppliers = await prisma.supplier.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        location: true,
        contact: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      success: true,
      count: suppliers.length,
      suppliers,
    });
  } catch (error) {
    console.error("Supplier list error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to fetch suppliers." },
      { status: 500 }
    );
  }
}

// POST: Register a new supplier.
export async function POST(request: Request) {
  try {
    const access = await requireStaffPermissions([
      "suppliers.write",
    ]);

    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
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

    const parsed = createSupplierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid supplier details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { name, location, contact } = parsed.data;

    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: {
          name,
          location: location || null,
          contact: contact || null,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "SUPPLIER_CREATED",
          entity: "Supplier",
          entityId: created.id,
          after: {
            name: created.name,
            location: created.location,
            contact: created.contact,
            isActive: created.isActive,
          },
        },
      });

      return created;
    });

    return NextResponse.json(
      {
        success: true,
        message: "Supplier registered successfully.",
        supplier,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Supplier creation error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to register supplier." },
      { status: 500 }
    );
  }
}
