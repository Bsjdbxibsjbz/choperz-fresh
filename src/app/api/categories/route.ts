
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

//export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: {
        isActive: true,
        parentId: null,
      },
      orderBy: [
        { sortOrder: "asc" },
        { name: "asc" },
      ],
      select: {
        id: true,
        slug: true,
        name: true,
        sortOrder: true,
        children: {
          where: {
            isActive: true,
          },
          orderBy: [
            { sortOrder: "asc" },
            { name: "asc" },
          ],
          select: {
            id: true,
            slug: true,
            name: true,
            sortOrder: true,
            _count: {
              select: {
                products: {
                  where: {
                    isActive: true,
                    deletedAt: null,
                  },
                },
              },
            },
          },
        },
      },
    });

    const result = categories.map((category) => {
      const children = category.children.map((child) => ({
        id: child.id,
        slug: child.slug,
        name: child.name,
        sortOrder: child.sortOrder,
        productCount: child._count.products,
      }));

      return {
        id: category.id,
        slug: category.slug,
        name: category.name,
        sortOrder: category.sortOrder,
        productCount: children.reduce(
          (total, child) => total + child.productCount,
          0
        ),
        children,
      };
    });

    return NextResponse.json({
      success: true,
      count: result.length,
      categories: result,
    });
  } catch (error) {
    console.error("Categories API error:", error);

    return NextResponse.json(
      { success: false, error: "Unable to fetch categories." },
      { status: 500 }
    );
  }
}
