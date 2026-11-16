
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

const adjustmentSchema = z
  .object({
    outletId: z.string().trim().min(1).max(100),
    productId: z.string().trim().min(1).max(100),

    // Positive adds stock; negative removes stock.
    gramsDelta: z
      .number()
      .int()
      .min(-1_000_000)
      .max(1_000_000)
      .refine((value) => value !== 0),

    type: z.enum([
      "ADJUSTMENT",
      "WASTAGE",
      "DAMAGE",
      "EXPIRY",
    ]),

    note: z.string().trim().min(3).max(500),
  })
  .strict()
  .superRefine((data, context) => {
    if (
      data.type !== "ADJUSTMENT" &&
      data.gramsDelta >= 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["gramsDelta"],
        message:
          "Wastage, damage and expiry must remove stock.",
      });
    }
  });

export async function POST(request: Request) {
  try {
    // 1. Authenticate staff and check inventory permission.
    const access = await requireStaffPermissions([
      "inventory.adjust",
    ]);

    if (!access.authorized) {
      return NextResponse.json(
        {
          success: false,
          error: access.message,
        },
        { status: access.status }
      );
    }

    const isSuperAdmin =
      access.roleName === "SUPER_ADMIN";

    const isOutletManager =
      access.roleName === "OUTLET_MANAGER";

    // 2. Parse and validate request body.
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON request body.",
        },
        { status: 400 }
      );
    }

    const parsed = adjustmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid inventory adjustment.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      outletId,
      productId,
      gramsDelta,
      type,
      note,
    } = parsed.data;

    // 3. Outlet Managers can only adjust their assigned outlet.
    if (isOutletManager) {
      if (!access.outletId) {
        return NextResponse.json(
          {
            success: false,
            error: "No outlet is assigned to this staff account.",
          },
          { status: 403 }
        );
      }

      if (outletId !== access.outletId) {
        return NextResponse.json(
          {
            success: false,
            error: "You cannot adjust another outlet's stock.",
          },
          { status: 403 }
        );
      }
    }

    // 4. Perform the adjustment atomically.
    const outcome = await prisma.$transaction(
      async (tx) => {
        const current = await tx.inventory.findUnique({
          where: {
            outletId_productId: {
              outletId,
              productId,
            },
          },
          include: {
            outlet: {
              select: {
                id: true,
                name: true,
                isActive: true,
              },
            },
            product: {
              select: {
                id: true,
                name: true,
                slug: true,
                isActive: true,
                isPlaceholder: true,
                deletedAt: true,
              },
            },
          },
        });

        if (!current || !current.outlet.isActive) {
          return { kind: "NOT_FOUND" as const };
        }

        if (
          !current.product.isActive ||
          current.product.deletedAt !== null
        ) {
          return { kind: "INACTIVE_PRODUCT" as const };
        }

        // Hidden placeholder inventory is Super Admin only.
        if (
          current.product.isPlaceholder &&
          !isSuperAdmin
        ) {
          return { kind: "FORBIDDEN" as const };
        }

        let affectedRows: number;

        if (gramsDelta < 0) {
          // Atomic stock guard. Reservations are not used; keep the legacy field at zero.
          affectedRows = await tx.$executeRaw`
            UPDATE "inventory"
            SET
              "onHandGrams" = "onHandGrams" + ${gramsDelta},
              "updatedAt" = NOW()
            WHERE
              "id" = ${current.id}
              AND "onHandGrams" >= ${Math.abs(gramsDelta)}
          `;
        } else {
          affectedRows = await tx.$executeRaw`
            UPDATE "inventory"
            SET
              "onHandGrams" = "onHandGrams" + ${gramsDelta},
              "reservedGrams" = 0,
              "updatedAt" = NOW()
            WHERE "id" = ${current.id}
          `;
        }

        if (affectedRows !== 1) {
          return { kind: "INSUFFICIENT_STOCK" as const };
        }

        // 5. Read the updated inventory balance.
        const updated = await tx.inventory.findUniqueOrThrow({
          where: { id: current.id },
        });

        // 6. Append the stock movement ledger entry.
        await tx.stockMovement.create({
          data: {
            outletId,
            productId,
            type,
            gramsDelta,
            note,
            actorId: access.userId,
          },
        });

        // 7. Record the administrative audit event.
        await tx.auditLog.create({
          data: {
            actorId: access.userId,
            action: "INVENTORY_ADJUSTED",
            entity: "Inventory",
            entityId: current.id,
            before: {
              onHandGrams: current.onHandGrams,
            },
            after: {
              onHandGrams: updated.onHandGrams,
              gramsDelta,
              movementType: type,
              note,
            },
          },
        });

        return {
          kind: "SUCCESS" as const,
          inventory: {
            outlet: {
              id: current.outlet.id,
              name: current.outlet.name,
            },
            product: {
              id: current.product.id,
              name: current.product.name,
              slug: current.product.slug,
            },
            onHandGrams: updated.onHandGrams,
            availableGrams: updated.onHandGrams,
          },
        };
      }
    );

    // 8. Handle transaction outcomes.
    if (outcome.kind === "NOT_FOUND") {
      return NextResponse.json(
        {
          success: false,
          error: "Inventory record or active outlet not found.",
        },
        { status: 404 }
      );
    }

    if (outcome.kind === "INACTIVE_PRODUCT") {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot adjust an inactive product.",
        },
        { status: 409 }
      );
    }

    if (outcome.kind === "FORBIDDEN") {
      return NextResponse.json(
        {
          success: false,
          error: "Only Super Admin can adjust placeholder products.",
        },
        { status: 403 }
      );
    }

    if (outcome.kind === "INSUFFICIENT_STOCK") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Insufficient stock for this adjustment.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Inventory adjustment recorded.",
        inventory: outcome.inventory,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Inventory adjustment error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to adjust inventory.",
      },
      { status: 500 }
    );
  }
}
