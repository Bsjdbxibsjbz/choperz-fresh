
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

const querySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(request: Request) {
  try {
    // 1. Require an authenticated staff account with product access.
    const access = await requireStaffPermissions(["products.read"]);

    if (!access.authorized) {
      return NextResponse.json(
        { success: false, error: access.message },
        { status: access.status }
      );
    }

    // Super Admin sees placeholders and inactive records; other product staff see published products only.
    const isSuperAdmin = access.roleName === "SUPER_ADMIN";

    // 3. Validate search, category and pagination parameters.
    const url = new URL(request.url);

    const parsed = querySchema.safeParse({
      q: url.searchParams.get("q")?.trim() || undefined,
      category: url.searchParams.get("category") || undefined,
      page: url.searchParams.get("page") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid catalogue query parameters.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { q, category, page, limit } = parsed.data;

    // 4. Build filters. Unlike public APIs, this includes
    // placeholders, inactive products and soft-deleted records.
    const where = {
      ...(!isSuperAdmin ? { isActive: true, isPlaceholder: false, deletedAt: null } : {}),
      ...(category
        ? {
            category: {
              slug: category,
            },
          }
        : {}),

      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { localName: { contains: q, mode: "insensitive" as const } },
              { englishName: { contains: q, mode: "insensitive" as const } },
              { scientificName: { contains: q, mode: "insensitive" as const } },
              { slug: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    // 5. Fetch all catalogue information needed by administration.
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { category: { name: "asc" } },
          { name: "asc" },
          { id: "asc" },
        ],
        select: {
          id: true,
          slug: true,
          name: true,
          localName: true,
          englishName: true,
          scientificName: true,
          description: true,
          sourceInfo: true,
          storageInstructions: true,

          isPlaceholder: true,
          isSourceVerified: true,
          isActive: true,
          deletedAt: true,

          createdAt: true,
          updatedAt: true,

          category: {
            select: {
              id: true,
              slug: true,
              name: true,
            },
          },

          variants: {
            orderBy: {
              weightGrams: "asc",
            },
            select: {
              id: true,
              sku: true,
              label: true,
              weightGrams: true,
              pricePaise: true,
              isActive: true,
            },
          },

          images: {
            orderBy: {
              sortOrder: "asc",
            },
            select: {
              id: true,
              url: true,
              kind: true,
              alt: true,
              sortOrder: true,
              isPlaceholder: true,
            },
          },

          nutrition: {
            select: {
              energyKcal: true,
              proteinG: true,
              fatG: true,
              carbsG: true,
              isVerified: true,
              source: true,
            },
          },

          cutOptions: {
            select: {
              cutOption: {
                select: {
                  id: true,
                  name: true,
                  extraPricePaise: true,
                },
              },
            },
          },
        },
      }),

      prisma.product.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      access: isSuperAdmin ? "SUPER_ADMIN" : "PRODUCT_STAFF",

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },

      products,
    });
  } catch (error) {
    console.error("Admin catalogue API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to fetch the administration catalogue.",
      },
      { status: 500 }
    );
  }
}


// POST: Create a product and its initial weight variants.
const createProductSchema = z.object({
  slug: z.string().trim().min(2).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(120),
  categoryId: z.string().trim().min(1).max(100),
  localName: z.string().trim().max(120).nullable().optional(),
  englishName: z.string().trim().max(120).nullable().optional(),
  scientificName: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(3000).nullable().optional(),
  sourceInfo: z.string().trim().max(1500).nullable().optional(),
  storageInstructions: z.string().trim().max(1500).nullable().optional(),
  isPlaceholder: z.boolean().default(false),
  isSourceVerified: z.boolean().default(false),
  variants: z.array(z.object({
    label: z.string().trim().min(1).max(40),
    weightGrams: z.number().int().min(1).max(100000),
    pricePaise: z.number().int().min(0).max(2147483647),
  }).strict()).min(1).max(12),
  cutOptionIds: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
}).strict().superRefine((data, ctx) => {
  const weights = data.variants.map(v => v.weightGrams);
  if (new Set(weights).size !== weights.length) {
    ctx.addIssue({ code: "custom", path: ["variants"], message: "Each weight must be unique." });
  }
});

export async function POST(request: Request) {
  const access = await requireStaffPermissions(["products.write", "prices.write", "categories.write"]);
  if (!access.authorized) {
    return NextResponse.json({ success: false, error: access.message }, { status: access.status });
  }

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON request body." }, { status: 400 }); }

  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid product details.", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  try {
    const product = await prisma.$transaction(async (tx) => {
      const category = await tx.category.findFirst({
        where: { id: data.categoryId, isActive: true },
        select: { id: true },
      });
      if (!category) throw new Error("CATEGORY_NOT_FOUND");

      if (data.cutOptionIds?.length) {
        const cuts = await tx.cutOption.findMany({
          where: { id: { in: data.cutOptionIds } },
          select: { id: true },
        });
        if (cuts.length !== new Set(data.cutOptionIds).size) throw new Error("CUT_OPTION_NOT_FOUND");
      }

      const created = await tx.product.create({
        data: {
          slug: data.slug,
          name: data.name,
          categoryId: data.categoryId,
          localName: data.localName ?? null,
          englishName: data.englishName ?? null,
          scientificName: data.scientificName ?? null,
          description: data.description ?? null,
          sourceInfo: data.sourceInfo ?? null,
          storageInstructions: data.storageInstructions ?? null,
          isPlaceholder: data.isPlaceholder,
          isSourceVerified: data.isSourceVerified,
          isActive: true,
          variants: {
            create: data.variants.map((variant) => ({
              sku: data.slug + "-" + variant.weightGrams + "g",
              label: variant.label,
              weightGrams: variant.weightGrams,
              pricePaise: variant.pricePaise,
              isActive: true,
            })),
          },
          ...(data.cutOptionIds?.length ? {
            cutOptions: {
              create: data.cutOptionIds.map((cutOptionId) => ({ cutOptionId })),
            },
          } : {}),
        },
        select: { id: true, slug: true, name: true, isActive: true, isPlaceholder: true, isSourceVerified: true },
      });

      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "PRODUCT_CREATED",
          entity: "Product",
          entityId: created.id,
          after: {
            slug: created.slug,
            name: created.name,
            categoryId: data.categoryId,
            variantCount: data.variants.length,
            isPlaceholder: data.isPlaceholder,
          },
        },
      });
      return created;
    });
    return NextResponse.json({ success: true, message: "Product created successfully.", product }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "CATEGORY_NOT_FOUND") {
      return NextResponse.json({ success: false, error: "Active category not found." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "CUT_OPTION_NOT_FOUND") {
      return NextResponse.json({ success: false, error: "One or more cutting options do not exist." }, { status: 400 });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ success: false, error: "Product slug or SKU already exists." }, { status: 409 });
    }
    console.error("Admin product creation failed:", error);
    return NextResponse.json({ success: false, error: "Unable to create product." }, { status: 500 });
  }
}
