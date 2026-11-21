
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/customer-authorization";

type RouteContext = {
  params: Promise<{
    addressId: string;
  }>;
};

const updateAddressSchema = z
  .object({
    label: z.string().trim().min(1).max(40).optional(),
    line1: z.string().trim().min(3).max(200).optional(),
    line2: z.string().trim().max(200).nullable().optional(),
    landmark: z.string().trim().max(120).nullable().optional(),
    city: z.string().trim().min(2).max(80).optional(),
    pincode: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter a valid 6-digit Indian pincode.")
      .optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    isDefault: z.literal(true).optional(),
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
        message: "Latitude and longitude must both be provided.",
        path: ["latitude"],
      });
    }

  });

// PATCH: Edit an address or make it the customer's default address.
export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const access = await requireCustomer();

    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      );
    }

    const { addressId } = await context.params;

    if (!addressId || addressId.length > 100) {
      return NextResponse.json(
        { success: false, error: "A valid address ID is required." },
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

    const parsed = updateAddressSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid address update details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { isDefault, ...addressData } = parsed.data;

    const updatedAddress = await prisma.$transaction(async (tx) => {
      const existingAddress = await tx.address.findFirst({
        where: {
          id: addressId,
          userId: access.userId,
          deletedAt: null,
        },
      });

      if (!existingAddress) {
        return null;
      }

      if (isDefault === true) {
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

      return tx.address.update({
        where: {
          id: existingAddress.id,
        },
        data: {
          ...addressData,
          ...(isDefault === true ? { isDefault: true } : {}),
        },
      });
    });

    if (!updatedAddress) {
      return NextResponse.json(
        { success: false, error: "Address not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        isDefault === true
          ? "Default address updated successfully."
          : "Address updated successfully.",
      address: updatedAddress,
    });
  } catch (error) {
    console.error("Update customer address error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to update customer address." },
      { status: 500 }
    );
  }
}

// DELETE: Soft-delete an address and reassign the default when necessary.
export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const access = await requireCustomer();

    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      );
    }

    const { addressId } = await context.params;

    if (!addressId || addressId.length > 100) {
      return NextResponse.json(
        { success: false, error: "A valid address ID is required." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingAddress = await tx.address.findFirst({
        where: {
          id: addressId,
          userId: access.userId,
          deletedAt: null,
        },
      });

      if (!existingAddress) {
        return null;
      }

      if (existingAddress.isDefault) {
        await tx.address.updateMany({
          where: {
            userId: access.userId,
            deletedAt: null,
          },
          data: {
            isDefault: false,
          },
        });
      }

      await tx.address.update({
        where: { id: existingAddress.id },
        data: {
          deletedAt: new Date(),
          isDefault: false,
        },
      });

      let newDefaultAddressId: string | null = null;

      if (existingAddress.isDefault) {
        const replacement = await tx.address.findFirst({
          where: {
            userId: access.userId,
            deletedAt: null,
          },
          orderBy: [
            { createdAt: "asc" },
            { id: "asc" },
          ],
        });

        if (replacement) {
          await tx.address.update({
            where: { id: replacement.id },
            data: { isDefault: true },
          });

          newDefaultAddressId = replacement.id;
        }
      }

      return {
        deletedAddressId: existingAddress.id,
        newDefaultAddressId,
      };
    });

    if (!result) {
      return NextResponse.json(
        { success: false, error: "Address not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Address deactivated successfully.",
      ...result,
    });
  } catch (error) {
    console.error("Delete customer address error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to deactivate customer address." },
      { status: 500 }
    );
  }
}
