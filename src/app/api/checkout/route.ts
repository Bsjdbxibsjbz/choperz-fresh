
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/customer-authorization";
import { Prisma } from "@/generated/prisma/client";

const checkoutSchema = z
  .object({
    addressId: z.string().trim().min(1).max(100),
    paymentMethod: z.enum(["COD", "RAZORPAY"]),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

function isErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

export async function POST(request: Request) {
  // 1. Require a verified customer account.
  const access = await requireCustomer();

  if (!access.authorized) {
    return NextResponse.json(
      { success: false, error: access.message },
      { status: access.status }
    );
  }

  // 2. Parse request body.
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON request body." },
      { status: 400 }
    );
  }

  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid checkout details.",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const { addressId, paymentMethod, notes } = parsed.data;

  // Razorpay must not be accepted until gateway order creation
  // and server-side payment verification are implemented.
  if (paymentMethod === "RAZORPAY") {
    return NextResponse.json(
      {
        success: false,
        error: "Online payments are not configured yet.",
        code: "RAZORPAY_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  try {
    // 3. Lock the customer's cart row to prevent simultaneous
    // checkout requests from creating duplicate orders.
    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw<{ id: string }[]>`
          SELECT "id"
          FROM "carts"
          WHERE "userId" = ${access.userId}
          FOR UPDATE
        `;

        // 4. Verify customer details.
        const user = await tx.user.findUnique({
          where: { id: access.userId },
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            phoneNumberVerified: true,
          },
        });

        if (
          !user ||
          !user.phoneNumber ||
          user.phoneNumberVerified !== true
        ) {
          throw new Error("CUSTOMER_VERIFICATION_REQUIRED");
        }

        // 5. Verify the saved delivery address belongs to customer.
        const address = await tx.address.findFirst({
          where: {
            id: addressId,
            userId: access.userId,
            deletedAt: null,
          },
        });

        if (!address) {
          throw new Error("ADDRESS_NOT_FOUND");
        }

        if (!/^\d{6}$/.test(address.pincode)) {
          throw new Error("INVALID_DELIVERY_PINCODE");
        }

        // 6. Load the customer's cart and current catalogue prices.
        const cart = await tx.cart.findUnique({
          where: {
            userId: access.userId,
          },
          include: {
            items: {
              include: {
                variant: {
                  include: {
                    product: {
                      include: {
                        cutOptions: {
                          select: {
                            cutOptionId: true,
                          },
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

        if (!cart || cart.items.length === 0) {
          throw new Error("CART_EMPTY");
        }

        // 7. Revalidate every cart item and calculate prices
        // directly from the database.
        const orderItems = cart.items.map((item) => {
          const variant = item.variant;
          const product = variant.product;

          const cutAllowed =
            !item.cutOptionId ||
            product.cutOptions.some(
              (option) =>
                option.cutOptionId === item.cutOptionId
            );

          const available =
            variant.isActive &&
            product.isActive &&
            !product.isPlaceholder &&
            product.deletedAt === null &&
            cutAllowed &&
            (!item.cutOptionId || item.cutOption !== null);

          if (!available) {
            throw new Error("CART_ITEM_UNAVAILABLE");
          }

          if (
            !Number.isInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > 99
          ) {
            throw new Error("INVALID_CART_QUANTITY");
          }

          const extraPricePaise =
            item.cutOption?.extraPricePaise ?? 0;

          const lineTotalPaise =
            (variant.pricePaise + extraPricePaise) *
            item.quantity;

          if (
            !Number.isSafeInteger(lineTotalPaise) ||
            lineTotalPaise <= 0
          ) {
            throw new Error("INVALID_ITEM_PRICE");
          }

          return {
            productId: product.id,
            variantId: variant.id,
            productName: product.name,
            variantLabel: variant.label,
            weightGrams: variant.weightGrams,
            unitPricePaise: variant.pricePaise,
            cutName: item.cutOption?.name ?? null,
            cutExtraPaise: extraPricePaise,
            quantity: item.quantity,
            lineTotalPaise,
          };
        });

        const subtotalPaise = orderItems.reduce(
          (total, item) => total + item.lineTotalPaise,
          0
        );

        if (
          !Number.isSafeInteger(subtotalPaise) ||
          subtotalPaise <= 0 ||
          subtotalPaise > 2_147_483_647
        ) {
          throw new Error("INVALID_ORDER_TOTAL");
        }

        // 8. Verify delivery serviceability.
        // A customer may place an order only if at least one
        // active outlet serves the saved pincode.
        const activeZone =
          await tx.outletDeliveryZone.findFirst({
            where: {
              pincode: address.pincode,
              isActive: true,
              outlet: {
                is: {
                  isActive: true,
                },
              },
            },
            select: {
              id: true,
            },
          });

        if (!activeZone) {
          throw new Error("DELIVERY_NOT_AVAILABLE");
        }

        // 9. Cash on Delivery is controlled by the admin setting.
        const codSetting = await tx.siteSetting.findUnique({
          where: {
            key: "cod_enabled",
          },
          select: {
            value: true,
          },
        });

        if (codSetting?.value !== true) {
          throw new Error("COD_DISABLED");
        }

        // 10. Create the order number.
        const orderNumber =
          `CF-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID()
            .replace(/-/g, "")
            .slice(0, 10)
            .toUpperCase()}`;

        // 11. Create the order and historical item snapshots.
        // No outlet is assigned and no stock is reserved here.
        const order = await tx.order.create({
          data: {
            orderNumber,
            userId: user.id,
            outletId: null,

            status: "pending",
            paymentStatus: "UNPAID",
            paymentMethod: "COD",

            subtotalPaise,
            deliveryFeePaise: 0,
            discountPaise: 0,
            totalPaise: subtotalPaise,

            shipName: user.name,
            shipPhone: user.phoneNumber,
            shipLine1: address.line1,
            shipLine2: address.line2,
            shipLandmark: address.landmark,
            shipCity: address.city,
            shipPincode: address.pincode,
            shipLatitude: address.latitude,
            shipLongitude: address.longitude,

            notes: notes || null,

            items: {
              create: orderItems,
            },

            history: {
              create: {
                fromStatus: null,
                toStatus: "pending",
                actorId: user.id,
                note:
                  "Order placed by customer. Awaiting outlet confirmation.",
              },
            },
          },
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            subtotalPaise: true,
            deliveryFeePaise: true,
            discountPaise: true,
            totalPaise: true,
            createdAt: true,
          },
        });

        // 12. Clear the cart only after successful order creation.
        await tx.cartItem.deleteMany({
          where: {
            cartId: cart.id,
          },
        });

        return order;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Order received. Outlet confirmation is pending.",
        order: {
          ...result,
          outletId: null,
          deliveryFeePaise: 0,
          stockReserved: false,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error) {
      const errors: Record<
        string,
        { status: number; message: string }
      > = {
        CUSTOMER_VERIFICATION_REQUIRED: {
          status: 403,
          message: "Verified customer details are required.",
        },
        ADDRESS_NOT_FOUND: {
          status: 404,
          message: "Saved delivery address not found.",
        },
        INVALID_DELIVERY_PINCODE: {
          status: 400,
          message: "The saved delivery pincode is invalid.",
        },
        CART_EMPTY: {
          status: 400,
          message: "Your cart is empty.",
        },
        CART_ITEM_UNAVAILABLE: {
          status: 409,
          message:
            "One or more cart items are no longer available. Please review your cart.",
        },
        INVALID_CART_QUANTITY: {
          status: 400,
          message: "A cart item has an invalid quantity.",
        },
        INVALID_ITEM_PRICE: {
          status: 409,
          message: "An item has an invalid price.",
        },
        INVALID_ORDER_TOTAL: {
          status: 400,
          message: "The order total is invalid.",
        },
        DELIVERY_NOT_AVAILABLE: {
          status: 422,
          message:
            "Delivery is not currently available for this pincode.",
        },
        COD_DISABLED: {
          status: 409,
          message:
            "Cash on Delivery is currently unavailable.",
        },
      };

      const knownError = errors[error.message];

      if (knownError) {
        return NextResponse.json(
          {
            success: false,
            error: knownError.message,
          },
          { status: knownError.status }
        );
      }
    }

    if (isErrorCode(error, "P2034")) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your cart changed during checkout. Please review it and try again.",
        },
        { status: 409 }
      );
    }

    console.error("Checkout failed:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to place your order.",
      },
      { status: 500 }
    );
  }
}
