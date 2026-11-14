
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  q: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export async function GET(request: Request) {
  try {
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
          error: "Invalid search or pagination parameters.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { q, category, page, limit } = parsed.data;

    // Resolve a parent category and all its active children.
    let categoryIds: string[] | undefined;

    if (category) {
      const selectedCategory = await prisma.category.findFirst({
        where: {
          slug: category,
          isActive: true,
        },
        select: {
          id: true,
          children: {
            where: { isActive: true },
            select: { id: true },
          },
        },
      });

      if (!selectedCategory) {
        return NextResponse.json(
          {
            success: false,
            error: "Category not found.",
          },
          { status: 404 }
        );
      }

      categoryIds = [
        selectedCategory.id,
        ...selectedCategory.children.map((child) => child.id),
      ];
    }

    // Build product filters.
    const where = {
      isActive: true,
      isPlaceholder: false,
      deletedAt: null,

      category: {
        isActive: true,
      },

      ...(categoryIds
        ? { categoryId: { in: categoryIds } }
        : {}),

      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" as const } },
              { localName: { contains: q, mode: "insensitive" as const } },
              { englishName: { contains: q, mode: "insensitive" as const } },
              { scientificName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    // Fetch products and total count.
    const [products, total] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [
          { name: "asc" },
          { id: "asc" },
        ],
        select: {
          id: true,
          slug: true,
          name: true,
          localName: true,
          englishName: true,
          description: true,
          storageInstructions: true,
          isPlaceholder: true,
          isSourceVerified: true,

          category: {
            select: {
              slug: true,
              name: true,
            },
          },

          variants: {
            where: { isActive: true },
            orderBy: { weightGrams: "asc" },
            select: {
              id: true,
              sku: true,
              label: true,
              weightGrams: true,
              pricePaise: true,
            },
          },

          images: {
            where: { isPlaceholder: false },
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              url: true,
              kind: true,
              alt: true,
              sortOrder: true,
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
                },
              },
            },
          },
        },
      }),

      prisma.product.count({ where }),
    ]);

    // Hide demo prices and unverified nutrition.
    const result = products.map((product) => ({
      id: product.id,
      slug: product.slug,
      name: product.name,
      localName: product.localName,
      englishName: product.englishName,
      description: product.description,
      storageInstructions: product.storageInstructions,

      isPlaceholder: product.isPlaceholder,
      isSourceVerified: product.isSourceVerified,

      category: product.category,

      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        label: variant.label,
        weightGrams: variant.weightGrams,
        pricePaise: product.isPlaceholder
          ? null
          : variant.pricePaise,
      })),

      images: product.images,

      nutrition: product.nutrition?.isVerified
        ? {
            energyKcal: product.nutrition.energyKcal,
            proteinG: product.nutrition.proteinG,
            fatG: product.nutrition.fatG,
            carbsG: product.nutrition.carbsG,
            source: product.nutrition.source,
          }
        : null,

      cutOptions: product.cutOptions.map(
        (item) => item.cutOption
      ),
    }));

    return NextResponse.json({
      success: true,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      products: result,
    });
  } catch (error) {
    console.error("Products API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to fetch products.",
      },
      { status: 500 }
    );
  }
}
