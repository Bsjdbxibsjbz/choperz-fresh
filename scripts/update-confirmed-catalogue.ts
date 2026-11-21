
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

type CatalogueItem = {
  oldSlug: string;
  slug: string;
  name: string;
  pricePerKgPaise: number;
  weights: number[];
};

const CATALOGUE: CatalogueItem[] = [
  // Fish: mapping follows the order supplied by the business.
  { oldSlug: "fish-placeholder-01", slug: "hamour", name: "Hamour", pricePerKgPaise: 49000, weights: [500, 1000] },
  { oldSlug: "fish-placeholder-02", slug: "indian-salmon", name: "Indian Salmon", pricePerKgPaise: 98000, weights: [500, 1000] },
  { oldSlug: "fish-placeholder-03", slug: "pink-perch", name: "Pink Perch", pricePerKgPaise: 38000, weights: [500, 1000] },
  { oldSlug: "fish-placeholder-04", slug: "black-pomfret", name: "Black Pomfret", pricePerKgPaise: 78000, weights: [500, 1000] },
  { oldSlug: "fish-placeholder-05", slug: "white-pomfret", name: "White Pomfret", pricePerKgPaise: 105000, weights: [500, 1000] },
  { oldSlug: "fish-placeholder-06", slug: "mackerel", name: "Mackerel", pricePerKgPaise: 32000, weights: [500, 1000] },
  { oldSlug: "fish-placeholder-07", slug: "sardine", name: "Sardine", pricePerKgPaise: 30000, weights: [500, 1000] },
  { oldSlug: "fish-placeholder-08", slug: "king-fish", name: "King Fish", pricePerKgPaise: 110000, weights: [500, 1000] },
  { oldSlug: "fish-placeholder-09", slug: "emperor-fish", name: "Emperor Fish", pricePerKgPaise: 67000, weights: [500, 1000] },
  { oldSlug: "fish-placeholder-10", slug: "cobia", name: "Cobia", pricePerKgPaise: 60000, weights: [500, 1000] },

  // Seafood
  { oldSlug: "crab-placeholder", slug: "red-sea-crab", name: "Red Sea Crab", pricePerKgPaise: 62000, weights: [500, 1000] },
  { oldSlug: "prawn-placeholder", slug: "tiger-prawns", name: "Tiger Prawns", pricePerKgPaise: 75000, weights: [250, 500] },

  // Chicken
  { oldSlug: "chicken-lollipops", slug: "chicken-lollipops", name: "Chicken Lollipops", pricePerKgPaise: 35000, weights: [500, 1000] },
  { oldSlug: "chicken-strips", slug: "chicken-strips", name: "Chicken Strips", pricePerKgPaise: 40000, weights: [500, 1000] },
  { oldSlug: "chicken-wings", slug: "chicken-wings", name: "Chicken Wings", pricePerKgPaise: 32000, weights: [500, 1000] },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is missing.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    console.log("\nCHOPERZ FRESH - Confirmed Catalogue Update");
    console.log(`Products to process: ${CATALOGUE.length}\n`);

    const summary = await prisma.$transaction(
      async (tx) => {
        let updated = 0;
        let alreadyCorrect = 0;

        for (const item of CATALOGUE) {
          // Find the existing record using its original slug.
          let product = await tx.product.findUnique({
            where: { slug: item.oldSlug },
          });

          // This also supports a safe rerun after a previous update.
          if (!product && item.oldSlug !== item.slug) {
            product = await tx.product.findUnique({
              where: { slug: item.slug },
            });
          }

          if (!product) {
            throw new Error(
              `Product not found: ${item.oldSlug}`
            );
          }

          // Prevent accidentally taking over a different product.
          const slugConflict = await tx.product.findUnique({
            where: { slug: item.slug },
            select: { id: true },
          });

          if (slugConflict && slugConflict.id !== product.id) {
            throw new Error(
              `Target slug already belongs to another product: ${item.slug}`
            );
          }

          // Confirm the existing weight variants match our approved plan.
          const variants = await tx.productVariant.findMany({
            where: { productId: product.id },
            orderBy: { weightGrams: "asc" },
            select: {
              id: true,
              sku: true,
              weightGrams: true,
              pricePaise: true,
            },
          });

          const existingWeights = variants
            .map((variant) => variant.weightGrams)
            .sort((a, b) => a - b);

          const expectedWeights = [...item.weights].sort(
            (a, b) => a - b
          );

          if (
            JSON.stringify(existingWeights) !==
            JSON.stringify(expectedWeights)
          ) {
            throw new Error(
              `Unexpected weight variants for ${item.oldSlug}. ` +
              `Expected ${expectedWeights.join(", ")}g; ` +
              `found ${existingWeights.join(", ")}g.`
            );
          }

          const expectedVariants = item.weights.map(
            (weightGrams) => ({
              weightGrams,
              sku: `${item.slug}-${weightGrams}g`,
              pricePaise: Math.round(
                (item.pricePerKgPaise * weightGrams) / 1000
              ),
            })
          );

          const variantChanges = expectedVariants.map((expected) => {
            const current = variants.find(
              (variant) =>
                variant.weightGrams === expected.weightGrams
            );

            if (!current) {
              throw new Error(
                `Missing ${expected.weightGrams}g variant for ${item.name}.`
              );
            }

            return {
              id: current.id,
              ...expected,
              changed:
                current.sku !== expected.sku ||
                current.pricePaise !== expected.pricePaise,
            };
          });

          const productChanged =
            product.slug !== item.slug ||
            product.name !== item.name ||
            product.isPlaceholder !== false ||
            product.isSourceVerified !== false ||
            product.isActive !== true ||
            product.deletedAt !== null ||
            product.description !== null;

          const hasVariantChanges = variantChanges.some(
            (variant) => variant.changed
          );

          if (!productChanged && !hasVariantChanges) {
            alreadyCorrect++;
            console.log(`Already correct: ${item.name}`);
            continue;
          }

          // Update the existing product, preserving its ID and relations.
          await tx.product.update({
            where: { id: product.id },
            data: {
              slug: item.slug,
              name: item.name,
              description: null,
              isPlaceholder: false,
              isSourceVerified: false,
              isActive: true,
              deletedAt: null,
            },
          });

          // Update existing variants without changing their IDs or weights.
          for (const variant of variantChanges) {
            if (!variant.changed) continue;

            await tx.productVariant.update({
              where: { id: variant.id },
              data: {
                sku: variant.sku,
                pricePaise: variant.pricePaise,
              },
            });
          }

          // Record what changed. This is a bootstrap/import operation,
          // so actorId is null rather than pretending an admin performed it.
          await tx.auditLog.create({
            data: {
              actorId: null,
              action: "CONFIRMED_CATALOGUE_PRODUCT_UPDATED",
              entity: "Product",
              entityId: product.id,
              before: {
                slug: product.slug,
                name: product.name,
                isPlaceholder: product.isPlaceholder,
                isSourceVerified: product.isSourceVerified,
                isActive: product.isActive,
                variants: variants.map((variant) => ({
                  sku: variant.sku,
                  weightGrams: variant.weightGrams,
                  pricePaise: variant.pricePaise,
                })),
              },
              after: {
                slug: item.slug,
                name: item.name,
                isPlaceholder: false,
                isSourceVerified: false,
                isActive: true,
                variants: expectedVariants,
              },
            },
          });

          updated++;
          console.log(`Updated: ${item.name}`);
        }

        return { updated, alreadyCorrect };
      },
      { timeout: 20000 }
    );

    console.log("\nCATALOGUE UPDATE SUCCESSFUL");
    console.log(`Updated products: ${summary.updated}`);
    console.log(`Already correct: ${summary.alreadyCorrect}`);
    console.log("Total processed: 15");
    console.log("Source verification remains pending.");
    console.log("Two unnamed fish placeholders were not modified.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    "\nCATALOGUE UPDATE FAILED:",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});
