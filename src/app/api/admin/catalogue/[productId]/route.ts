import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

type RouteContext = { params: Promise<{ productId: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  localName: z.string().trim().max(120).nullable().optional(),
  englishName: z.string().trim().max(120).nullable().optional(),
  scientificName: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(3000).nullable().optional(),
  sourceInfo: z.string().trim().max(1500).nullable().optional(),
  storageInstructions: z.string().trim().max(1500).nullable().optional(),
  categoryId: z.string().trim().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
  isPlaceholder: z.boolean().optional(),
  isSourceVerified: z.boolean().optional(),
  variants: z.array(z.object({
    id: z.string().trim().min(1).max(100),
    label: z.string().trim().min(1).max(40).optional(),
    pricePaise: z.number().int().min(0).max(2147483647).optional(),
    isActive: z.boolean().optional(),
  }).strict().refine(v => v.label !== undefined || v.pricePaise !== undefined || v.isActive !== undefined)).max(30).optional(),
}).strict().refine(data => Object.keys(data).length > 0);

export async function PATCH(request: Request, context: RouteContext) {
  const { productId } = await context.params;
  if (!productId || productId.length > 100) {
    return NextResponse.json({ success: false, error: "A valid product ID is required." }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON request body." }, { status: 400 }); }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid product update.", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const required = ["products.read"];
  const hasProductFields = ["name","localName","englishName","scientificName","description","sourceInfo","storageInstructions","isActive","isPlaceholder","isSourceVerified"].some(key => (data as Record<string, unknown>)[key] !== undefined);
  if (hasProductFields) required.push("products.write");
  if (data.categoryId !== undefined) required.push("categories.write");
  if (data.variants?.length) required.push("prices.write");

  const access = await requireStaffPermissions(required);
  if (!access.authorized) {
    return NextResponse.json({ success: false, error: access.message }, { status: access.status });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true, name: true, categoryId: true, isActive: true,
          isPlaceholder: true, isSourceVerified: true,
        },
      });
      if (!existing) throw new Error("PRODUCT_NOT_FOUND");

      if (data.categoryId) {
        const category = await tx.category.findFirst({
          where: { id: data.categoryId, isActive: true },
          select: { id: true },
        });
        if (!category) throw new Error("CATEGORY_NOT_FOUND");
      }

      if (data.variants?.length) {
        const ids = data.variants.map(v => v.id);
        if (new Set(ids).size !== ids.length) throw new Error("DUPLICATE_VARIANT");
        const owned = await tx.productVariant.findMany({
          where: { id: { in: ids }, productId },
          select: { id: true },
        });
        if (owned.length !== ids.length) throw new Error("VARIANT_NOT_FOUND");
        for (const variant of data.variants) {
          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              ...(variant.label !== undefined ? { label: variant.label } : {}),
              ...(variant.pricePaise !== undefined ? { pricePaise: variant.pricePaise } : {}),
              ...(variant.isActive !== undefined ? { isActive: variant.isActive } : {}),
            },
          });
        }
      }

      const productData: Prisma.ProductUpdateInput = {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.localName !== undefined ? { localName: data.localName } : {}),
        ...(data.englishName !== undefined ? { englishName: data.englishName } : {}),
        ...(data.scientificName !== undefined ? { scientificName: data.scientificName } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.sourceInfo !== undefined ? { sourceInfo: data.sourceInfo } : {}),
        ...(data.storageInstructions !== undefined ? { storageInstructions: data.storageInstructions } : {}),
        ...(data.categoryId !== undefined ? { category: { connect: { id: data.categoryId } } } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.isPlaceholder !== undefined ? { isPlaceholder: data.isPlaceholder } : {}),
        ...(data.isSourceVerified !== undefined ? { isSourceVerified: data.isSourceVerified } : {}),
      };

      const product = Object.keys(productData).length
        ? await tx.product.update({
            where: { id: productId },
            data: productData,
            select: { id: true, slug: true, name: true, isActive: true, isPlaceholder: true, isSourceVerified: true },
          })
        : await tx.product.findUniqueOrThrow({
            where: { id: productId },
            select: { id: true, slug: true, name: true, isActive: true, isPlaceholder: true, isSourceVerified: true },
          });

      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "PRODUCT_ADMIN_UPDATED",
          entity: "Product",
          entityId: productId,
          before: existing,
          after: {
            ...product,
            updatedVariantCount: data.variants?.length ?? 0,
            changedFields: Object.keys(data).filter(key => key !== "variants"),
          },
        },
      });

      return product;
    });

    return NextResponse.json({ success: true, message: "Product updated successfully.", product: result });
  } catch (error) {
    if (error instanceof Error) {
      const known: Record<string, { status: number; message: string }> = {
        PRODUCT_NOT_FOUND: { status: 404, message: "Product not found." },
        CATEGORY_NOT_FOUND: { status: 400, message: "Active category not found." },
        VARIANT_NOT_FOUND: { status: 404, message: "One or more variants do not belong to this product." },
        DUPLICATE_VARIANT: { status: 400, message: "Variant IDs must be unique." },
      };
      if (known[error.message]) return NextResponse.json({ success: false, error: known[error.message].message }, { status: known[error.message].status });
    }
    console.error("Admin product update failed:", error);
    return NextResponse.json({ success: false, error: "Unable to update product." }, { status: 500 });
  }
}
