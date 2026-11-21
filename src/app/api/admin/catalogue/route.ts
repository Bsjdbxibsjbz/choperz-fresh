
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
