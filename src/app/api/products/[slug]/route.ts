
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug: rawSlug } = await params;

    const parsedSlug = slugSchema.safeParse(rawSlug);

    if (!parsedSlug.success) {
      return NextResponse.json(
        { success: false, error: "Invalid product slug." },
        { status: 400 }
      );
    }

    const product = await prisma.product.findFirst({
      where: {
        slug: parsedSlug.data,
        isActive: true,
        isPlaceholder: false,
        deletedAt: null,
        category: {
          isActive: true,
        },
      },
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
        isSourceVerified: true,

        category: {
          select: {
            slug: true,
            name: true,
            parent: {
              select: {
                slug: true,
                name: true,
              },
            },
          },
        },

        variants: {
          where: { isActive: true },
          orderBy: { weightGrams: "asc" },
          select: {
            id: true,
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
    });

    if (!product) {
      return NextResponse.json(
        { success: false, error: "Product not found." },
        { status: 404 }
      );
    }

    const result = {
      id: product.id,
      slug: product.slug,
      name: product.name,
      localName: product.localName,
      englishName: product.englishName,

      scientificName: product.isSourceVerified
        ? product.scientificName
        : null,

      description: product.description,

      sourceInfo: product.isSourceVerified
        ? product.sourceInfo
        : null,

      storageInstructions: product.storageInstructions,
      isSourceVerified: product.isSourceVerified,

      category: product.category,

      variants: product.variants.map((variant) => ({
        id: variant.id,
        label: variant.label,
        weightGrams: variant.weightGrams,
        pricePaise: variant.pricePaise,
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
    };

    return NextResponse.json({
      success: true,
      product: result,
    });
  } catch (error) {
    console.error("Product details API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Unable to fetch product details.",
      },
      { status: 500 }
    );
  }
}
