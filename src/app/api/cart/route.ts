
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/customer-authorization";

const addItemSchema = z.object({
  variantId: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1).max(99),
  cutOptionId: z.string().trim().min(1).max(100).nullable().optional(),
}).strict();

const updateItemSchema = z.object({
  itemId: z.string().trim().min(1).max(100),
  quantity: z.number().int().min(1).max(99),
}).strict();

// GET: View the customer's cart.
export async function GET() {
  try {
    const access = await requireCustomer();

    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      );
    }

    const cart = await prisma.cart.findUnique({
      where: {
        userId: access.userId,
      },
      include: {
        items: {
          orderBy: { id: "asc" },
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    images: {
                      where: { isPlaceholder: false },
                      orderBy: { sortOrder: "asc" },
                      take: 1,
                    },
                    cutOptions: {
                      select: { cutOptionId: true },
                    },
                  },
                },
              },
            },
            cutOption: true,
          },
        },
      },
    });

    if (!cart) {
      return NextResponse.json({
        success: true,
        cart: {
          id: null,
          items: [],
          subtotalPaise: 0,
          totalQuantity: 0,
          unavailableItemsCount: 0,
        },
      });
    }

    const items = cart.items.map((item) => {
      const variant = item.variant;
      const product = variant.product;

      const cutAllowed =
        !item.cutOptionId ||
        product.cutOptions.some(
          (option) => option.cutOptionId === item.cutOptionId
        );

      const available =
        variant.isActive &&
        product.isActive &&
        !product.isPlaceholder &&
        product.deletedAt === null &&
        cutAllowed;

      let unavailableReason: string | null = null;

      if (!variant.isActive || !product.isActive ||
          product.isPlaceholder || product.deletedAt !== null) {
        unavailableReason = "This product or weight option is no longer available.";
      } else if (!cutAllowed) {
        unavailableReason = "This cutting option is no longer available for this product.";
      }

      const unitPricePaise =
        variant.pricePaise +
        (item.cutOption?.extraPricePaise ?? 0);

      const lineTotalPaise = available
        ? unitPricePaise * item.quantity
        : 0;

      return {
        id: item.id,
        quantity: item.quantity,
        available,
        unavailableReason,
        variant: {
          id: variant.id,
          label: variant.label,
          weightGrams: variant.weightGrams,
          pricePaise: variant.pricePaise,
          product: {
            id: product.id,
            slug: product.slug,
            name: product.name,
            images: product.images,
          },
        },
        cutOption: item.cutOption
          ? {
              id: item.cutOption.id,
              name: item.cutOption.name,
              extraPricePaise: item.cutOption.extraPricePaise,
            }
          : null,
        unitPricePaise,
        lineTotalPaise,
      };
    });

    const subtotalPaise = items.reduce(
      (total, item) => total + item.lineTotalPaise,
      0
    );

    const totalQuantity = items.reduce(
      (total, item) => total + item.quantity,
      0
    );

    return NextResponse.json({
      success: true,
      cart: {
        id: cart.id,
        items,
        subtotalPaise,
        totalQuantity,
        unavailableItemsCount: items.filter(
          (item) => !item.available
        ).length,
      },
    });
  } catch (error) {
    console.error("Get cart error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to fetch cart." },
      { status: 500 }
    );
  }
}

// POST: Add a product variant to the cart.
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

    const parsed = addItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid cart item details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Always fetch the actual price from the database.
    const variant = await prisma.productVariant.findUnique({
      where: { id: data.variantId },
      include: {
        product: {
          include: {
            cutOptions: {
              include: {
                cutOption: true,
              },
            },
          },
        },
      },
    });

    if (
      !variant ||
      !variant.isActive ||
      !variant.product.isActive ||
      variant.product.isPlaceholder ||
      variant.product.deletedAt !== null
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Product or weight option is unavailable.",
        },
        { status: 404 }
      );
    }

    const selectedCutId = data.cutOptionId ?? null;

    let extraPricePaise = 0;

    if (selectedCutId) {
      const allowedCut = variant.product.cutOptions.find(
        (option) => option.cutOptionId === selectedCutId
      );

      if (!allowedCut) {
        return NextResponse.json(
          {
            success: false,
            error: "This cutting option is not available for this product.",
          },
          { status: 400 }
        );
      }

      extraPricePaise = allowedCut.cutOption.extraPricePaise;
    }

    // Create the cart if this customer does not have one.
    // Merge matching variant and cutting-option items.
    const savedItem = await prisma.$transaction(async (tx) => {
      const cart = await tx.cart.upsert({
        where: { userId: access.userId },
        update: {},
        create: { userId: access.userId },
        select: { id: true },
      });

      const existingItem = await tx.cartItem.findFirst({
        where: {
          cartId: cart.id,
          variantId: data.variantId,
          cutOptionId: selectedCutId,
        },
      });

      if (existingItem) {
        const newQuantity = existingItem.quantity + data.quantity;

        if (newQuantity > 99) {
          throw new Error("CART_QUANTITY_LIMIT");
        }

        return tx.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: newQuantity },
          select: {
            id: true,
            quantity: true,
            variantId: true,
            cutOptionId: true,
          },
        });
      }

      return tx.cartItem.create({
        data: {
          cartId: cart.id,
          variantId: data.variantId,
          cutOptionId: selectedCutId,
          quantity: data.quantity,
        },
        select: {
          id: true,
          quantity: true,
          variantId: true,
          cutOptionId: true,
        },
      });
    });

    return NextResponse.json(
      {
        success: true,
        message: "Item added to cart.",
        item: {
          ...savedItem,
          unitPricePaise: variant.pricePaise + extraPricePaise,
          lineTotalPaise:
            (variant.pricePaise + extraPricePaise) *
            savedItem.quantity,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "CART_QUANTITY_LIMIT"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Maximum quantity per cart item is 99.",
        },
        { status: 400 }
      );
    }

    console.error("Add cart item error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to add item to cart." },
      { status: 500 }
    );
  }
}

// PATCH: Change the quantity of an existing cart item.
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

    const parsed = updateItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid cart update details.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: access.userId },
      select: { id: true },
    });

    if (!cart) {
      return NextResponse.json(
        { success: false, error: "Cart not found." },
        { status: 404 }
      );
    }

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        id: parsed.data.itemId,
        cartId: cart.id,
      },
    });

    if (!existingItem) {
      return NextResponse.json(
        { success: false, error: "Cart item not found." },
        { status: 404 }
      );
    }

    const updatedItem = await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: parsed.data.quantity },
      select: {
        id: true,
        quantity: true,
        variantId: true,
        cutOptionId: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Cart quantity updated.",
      item: updatedItem,
    });
  } catch (error) {
    console.error("Update cart error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to update cart." },
      { status: 500 }
    );
  }
}

// DELETE: Remove an item from the customer's cart.
// Example: DELETE /api/cart?itemId=abc123
export async function DELETE(request: Request) {
  try {
    const access = await requireCustomer();

    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      );
    }

    const url = new URL(request.url);
    const itemId = url.searchParams.get("itemId");

    if (!itemId || itemId.length > 100) {
      return NextResponse.json(
        { success: false, error: "A valid cart item ID is required." },
        { status: 400 }
      );
    }

    const cart = await prisma.cart.findUnique({
      where: { userId: access.userId },
      select: { id: true },
    });

    if (!cart) {
      return NextResponse.json(
        { success: false, error: "Cart not found." },
        { status: 404 }
      );
    }

    const deleted = await prisma.cartItem.deleteMany({
      where: {
        id: itemId,
        cartId: cart.id,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { success: false, error: "Cart item not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Item removed from cart.",
    });
  } catch (error) {
    console.error("Remove cart item error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to remove cart item." },
      { status: 500 }
    );
  }
}
