
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/customer-authorization";

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
  })
  .strict();

// GET: Retrieve the authenticated customer's profile.
export async function GET() {
  try {
    const access = await requireCustomer();

    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: access.userId },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        phoneNumberVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Customer account not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      profile: {
        id: user.id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        phoneNumberVerified: user.phoneNumberVerified === true,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get customer profile error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to fetch customer profile." },
      { status: 500 }
    );
  }
}

// PATCH: Update the authenticated customer's name.
export async function PATCH(request: Request) {
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

    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid customer profile details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: access.userId },
      data: {
        name: parsed.data.name,
      },
      select: {
        id: true,
        name: true,
        phoneNumber: true,
        phoneNumberVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Customer profile updated successfully.",
      profile: {
        id: updatedUser.id,
        name: updatedUser.name,
        phoneNumber: updatedUser.phoneNumber,
        phoneNumberVerified:
          updatedUser.phoneNumberVerified === true,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update customer profile error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to update customer profile." },
      { status: 500 }
    );
  }
}
