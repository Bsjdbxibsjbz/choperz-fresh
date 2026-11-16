
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/customer-authorization";

const createAddressSchema = z
  .object({
    label: z.string().trim().min(1).max(40).default("Home"),
    line1: z.string().trim().min(3).max(200),
    line2: z.string().trim().max(200).nullable().optional(),
    landmark: z.string().trim().max(120).nullable().optional(),
    city: z.string().trim().min(2).max(80).default("Mysuru"),
    pincode: z.string().trim().regex(/^\d{6}$/, "Enter a valid 6-digit Indian pincode."),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    isDefault: z.boolean().default(false),
  })
  .strict()
;

// GET: List the authenticated customer's active addresses.
export async function GET() {
  try {
    const access = await requireCustomer();

    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      );
    }

    const addresses = await prisma.address.findMany({
      where: {
        userId: access.userId,
        deletedAt: null,
      },
      orderBy: [
        { isDefault: "desc" },
        { updatedAt: "desc" },
      ],
    });

    return NextResponse.json({
      success: true,
      addresses,
      total: addresses.length,
    });
  } catch (error) {
    console.error("Get customer addresses error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to fetch customer addresses." },
      { status: 500 }
    );
  }
}

// POST: Add a new address.
export async function POST(request: Request) {
  try {
    const access = await requireCustomer();

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

    const parsed = createAddressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid address details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const address = await prisma.$transaction(async (tx) => {
      const activeAddressCount = await tx.address.count({
        where: {
          userId: access.userId,
          deletedAt: null,
        },
      });

      // The first active address becomes the default automatically.
      const makeDefault = data.isDefault || activeAddressCount === 0;

      if (makeDefault) {
        await tx.address.updateMany({
          where: {
            userId: access.userId,
            deletedAt: null,
            isDefault: true,
          },
          data: {
            isDefault: false,
          },
        });
      }

      return tx.address.create({
        data: {
          userId: access.userId,
          label: data.label,
          line1: data.line1,
          line2: data.line2 ?? null,
          landmark: data.landmark ?? null,
          city: data.city,
          pincode: data.pincode,
          latitude: data.latitude,
          longitude: data.longitude,
          isDefault: makeDefault,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: "Address added successfully.",
        address,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create customer address error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to add customer address." },
      { status: 500 }
    );
  }
}
