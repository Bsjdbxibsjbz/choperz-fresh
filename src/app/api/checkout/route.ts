
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


function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371.0088;
  const dLat = radians(lat2 - lat1);
  const dLon = radians(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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


        // Pincode zones establish serviceability. GPS is optional: when it is
        // present, it ranks outlets and applies maxRadiusKm; otherwise pincode
        // coverage is authoritative.
        const requirements = new Map<string, { grams: number; productName: string }>();
        for (const item of orderItems) {
          const current = requirements.get(item.productId) ?? {
            grams: 0,
            productName: item.productName,
          };
          current.grams += item.weightGrams * item.quantity;
          if (!Number.isSafeInteger(current.grams)) {
            throw new Error("INVALID_STOCK_QUANTITY");
          }
          requirements.set(item.productId, current);
        }

        const serviceableOutlets = await tx.outlet.findMany({
          where: {
            isActive: true,
            zones: { some: { pincode: address.pincode, isActive: true } },
          },
          select: {
            id: true,
            code: true,
            name: true,
            latitude: true,
            longitude: true,
            maxRadiusKm: true,
          },
        });

        if (serviceableOutlets.length === 0) {
          throw new Error("DELIVERY_NOT_AVAILABLE");
        }

        const hasAddressCoordinates =
          address.latitude !== null && address.longitude !== null;

        const rankedOutlets = serviceableOutlets
          .map((outlet) => {
            const outletDistanceKm =
              hasAddressCoordinates &&
              outlet.latitude !== null &&
              outlet.longitude !== null
                ? distanceKm(
                    address.latitude as number,
                    address.longitude as number,
                    outlet.latitude,
                    outlet.longitude
                  )
                : null;

            return { ...outlet, distanceKm: outletDistanceKm };
          })
          .filter(
            (outlet) =>
              outlet.distanceKm === null ||
              outlet.maxRadiusKm === null ||
              outlet.distanceKm <= outlet.maxRadiusKm
          )
          .sort((a, b) => {
            if (a.distanceKm === null && b.distanceKm === null) {
              return a.code.localeCompare(b.code);
            }
            if (a.distanceKm === null) return 1;
            if (b.distanceKm === null) return -1;
            return a.distanceKm - b.distanceKm;
          });

        if (rankedOutlets.length === 0) {
          throw new Error("DELIVERY_NOT_AVAILABLE");
        }

        // Choose the nearest (or, without GPS, first configured) outlet that
        // can fulfil the complete basket.
        let selectedOutlet: (typeof rankedOutlets)[number] | null = null;

        for (const outlet of rankedOutlets) {
          const inventoryRows = await tx.inventory.findMany({
            where: {
              outletId: outlet.id,
              productId: { in: Array.from(requirements.keys()) },
            },
            select: {
              productId: true,
              onHandGrams: true,
            },
          });

          const inventoryByProduct = new Map(
            inventoryRows.map((row) => [row.productId, row.onHandGrams])
          );

          const canFulfil = Array.from(requirements.entries()).every(
            ([productId, requirement]) =>
              (inventoryByProduct.get(productId) ?? 0) >= requirement.grams
          );

          if (canFulfil) {
            selectedOutlet = outlet;
            break;
          }
        }

        if (!selectedOutlet) {
          throw new Error("INSUFFICIENT_STOCK");
        }

        // Cash on Delivery is controlled by the admin setting.
        const codSetting = await tx.siteSetting.findUnique({
          where: { key: "cod_enabled" },
          select: { value: true },
        });
        if (codSetting?.value !== true) {
          throw new Error("COD_DISABLED");
        }

        const orderNumber =
          "CF-" +
          new Date().toISOString().slice(0, 10).replace(/-/g, "") +
          "-" +
          randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();

        const order = await tx.order.create({
          data: {
            orderNumber,
            userId: user.id,
            outletId: selectedOutlet.id,
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
            items: { create: orderItems },
            history: {
              create: {
                fromStatus: null,
                toStatus: "pending",
                actorId: user.id,
                note: "Order placed and assigned to outlet: " + selectedOutlet.code + ".",
              },
            },
          },
          select: {
            id: true,
            orderNumber: true,
            outletId: true,
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

        // Deduct stock immediately using conditional atomic updates. No reservations are created.
        for (const [productId, requirement] of [...requirements.entries()].sort(([a], [b]) => a.localeCompare(b))) {
          const changed = await tx.inventory.updateMany({
            where: {
              outletId: selectedOutlet.id,
              productId,
              onHandGrams: { gte: requirement.grams },
            },
            data: {
              onHandGrams: { decrement: requirement.grams },
              reservedGrams: 0,
            },
          });

          if (changed.count !== 1) {
            throw new Error("INSUFFICIENT_STOCK");
          }

          await tx.stockMovement.create({
            data: {
              outletId: selectedOutlet.id,
              productId,
              type: "SALE_DEDUCT",
              gramsDelta: -requirement.grams,
              orderId: order.id,
              actorId: user.id,
              note: "Stock deducted for order " + order.orderNumber + ".",
            },
          });
        }

        // 12. Clear the cart only after successful order creation.
        await tx.cartItem.deleteMany({
          where: {
            cartId: cart.id,
          },
        });

        return {
          ...order,
          outlet: {
            id: selectedOutlet.id,
            code: selectedOutlet.code,
            name: selectedOutlet.name,
            distanceKm:
              selectedOutlet.distanceKm === null
                ? null
                : Number(selectedOutlet.distanceKm.toFixed(2)),
          },
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Order placed and assigned to an eligible outlet.",
        order: {
          ...result,
          deliveryFeePaise: 0,
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
        OUTLET_LOCATION_NOT_CONFIGURED: {
          status: 503,
          message: "Delivery is temporarily unavailable because outlet GPS locations are not configured.",
        },
        INVALID_STOCK_QUANTITY: {
          status: 400,
          message: "The requested stock quantity is invalid.",
        },
        INSUFFICIENT_STOCK: {
          status: 409,
          message: "One or more items do not have enough stock at the nearest outlet. Please update your cart or try again later.",
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
            "No eligible outlet can deliver to this address.",
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
