
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

// ─────────────────────────────────────────────
// PERMISSIONS AND ROLES
// ─────────────────────────────────────────────

const PERMISSIONS = [
  "products.read",
  "products.write",
  "categories.write",
  "prices.write",
  "images.write",
  "inventory.read",
  "inventory.adjust",
  "inventory.transfer",
  "suppliers.write",
  "batches.write",
  "orders.read",
  "orders.update_status",
  "payments.read",
  "refunds.write",
  "customers.read",
  "recipes.write",
  "content.write",
  "outlets.write",
  "zones.write",
  "staff.manage",
  "roles.manage",
  "reports.read",
  "settings.write",
  "audit.read",
] as const;

const ROLES: Record<
  string,
  { description: string; permissions: readonly string[] }
> = {
  SUPER_ADMIN: {
    description: "Full system access",
    permissions: PERMISSIONS,
  },

  INVENTORY_MANAGER: {
    description:
      "Central inventory, suppliers, batches, transfers, adjustments",
    permissions: [
      "inventory.read",
      "inventory.adjust",
      "inventory.transfer",
      "suppliers.write",
      "batches.write",
      "products.read",
    ],
  },

  OUTLET_MANAGER: {
    description:
      "Assigned outlet inventory and orders, scoped by outlet",
    permissions: [
      "inventory.read",
      "inventory.adjust",
      "orders.read",
      "orders.update_status",
      "products.read",
    ],
  },

  PRODUCT_MANAGER: {
    description: "Products, categories, variants, prices, photographs",
    permissions: [
      "products.read",
      "products.write",
      "categories.write",
      "prices.write",
      "images.write",
    ],
  },

  ORDER_MANAGER: {
    description: "View and process permitted orders",
    permissions: [
      "orders.read",
      "orders.update_status",
      "products.read",
    ],
  },

  CONTENT_MANAGER: {
    description: "Product descriptions, recipes, recipe links",
    permissions: [
      "products.read",
      "recipes.write",
      "content.write",
    ],
  },
};

// ─────────────────────────────────────────────
// CATALOGUE
// Prices are stored in paise per kilogram.
// ─────────────────────────────────────────────

type Seed = {
  slug: string;
  name: string;
  category: string;
  weights: number[];
  cuts: string[];
  pricePerKgPaise: number;
  isPlaceholder: boolean;
};

const priceFor = (
  weightGrams: number,
  pricePerKgPaise: number
) =>
  Math.round(
    (weightGrams / 1000) * pricePerKgPaise
  );

const FISH_CUTS = [
  "Whole, cleaned",
  "Curry cut",
  "Fillet",
];

const products: Seed[] = [
  // ─────────── CONFIRMED FISH ───────────

  {
    slug: "hamour",
    name: "Hamour",
    category: "fish",
    weights: [500, 1000],
    cuts: FISH_CUTS,
    pricePerKgPaise: 49000,
    isPlaceholder: false,
  },
  {
    slug: "indian-salmon",
    name: "Indian Salmon",
    category: "fish",
    weights: [500, 1000],
    cuts: FISH_CUTS,
    pricePerKgPaise: 98000,
    isPlaceholder: false,
  },
  {
    slug: "pink-perch",
    name: "Pink Perch",
    category: "fish",
    weights: [500, 1000],
    cuts: FISH_CUTS,
    pricePerKgPaise: 38000,
    isPlaceholder: false,
  },
  {
    slug: "black-pomfret",
    name: "Black Pomfret",
    category: "fish",
    weights: [500, 1000],
    cuts: FISH_CUTS,
    pricePerKgPaise: 78000,
    isPlaceholder: false,
  },
  {
    slug: "white-pomfret",
    name: "White Pomfret",
    category: "fish",
    weights: [500, 1000],
    cuts: FISH_CUTS,
    pricePerKgPaise: 105000,
    isPlaceholder: false,
  },
  {
    slug: "mackerel",
    name: "Mackerel",
    category: "fish",
    weights: [500, 1000],
    cuts: FISH_CUTS,
    pricePerKgPaise: 32000,
    isPlaceholder: false,
  },
  {
    slug: "sardine",
    name: "Sardine",
    category: "fish",
    weights: [500, 1000],
    cuts: FISH_CUTS,
    pricePerKgPaise: 30000,
    isPlaceholder: false,
  },
  {
    slug: "king-fish",
    name: "King Fish",
    category: "fish",
    weights: [500, 1000],
    cuts: FISH_CUTS,
    pricePerKgPaise: 110000,
    isPlaceholder: false,
  },
  {
    slug: "emperor-fish",
    name: "Emperor Fish",
    category: "fish",
    weights: [500, 1000],
    cuts: FISH_CUTS,
    pricePerKgPaise: 67000,
    isPlaceholder: false,
  },
  {
    slug: "cobia",
    name: "Cobia",
    category: "fish",
    weights: [500, 1000],
    cuts: FISH_CUTS,
    pricePerKgPaise: 60000,
    isPlaceholder: false,
  },

  // ─────────── HIDDEN FISH PLACEHOLDERS ───────────

  {
    slug: "fish-placeholder-11",
    name: "Fish Placeholder 11",
    category: "fish",
    weights: [500, 1000],
    cuts: FISH_CUTS,
    pricePerKgPaise: 40000,
    isPlaceholder: true,
  },
  {
    slug: "fish-placeholder-12",
    name: "Fish Placeholder 12",
    category: "fish",
    weights: [500, 1000],
    cuts: FISH_CUTS,
    pricePerKgPaise: 40000,
    isPlaceholder: true,
  },

  // ─────────── CRAB ───────────

  {
    slug: "red-sea-crab",
    name: "Red Sea Crab",
    category: "crab",
    weights: [500, 1000],
    cuts: ["Cleaned & cut"],
    pricePerKgPaise: 62000,
    isPlaceholder: false,
  },

  // ─────────── PRAWNS ───────────

  {
    slug: "tiger-prawns",
    name: "Tiger Prawns",
    category: "prawns",
    weights: [250, 500],
    cuts: ["Peeled & deveined", "Shell-on"],
    pricePerKgPaise: 75000,
    isPlaceholder: false,
  },

  // ─────────── CHICKEN ───────────

  {
    slug: "chicken-lollipops",
    name: "Chicken Lollipops",
    category: "chicken-lollipops",
    weights: [500, 1000],
    cuts: [],
    pricePerKgPaise: 35000,
    isPlaceholder: false,
  },
  {
    slug: "chicken-strips",
    name: "Chicken Strips",
    category: "chicken-strips",
    weights: [500, 1000],
    cuts: [],
    pricePerKgPaise: 40000,
    isPlaceholder: false,
  },
  {
    slug: "chicken-wings",
    name: "Chicken Wings",
    category: "chicken-wings",
    weights: [500, 1000],
    cuts: [],
    pricePerKgPaise: 32000,
    isPlaceholder: false,
  },
];

// ─────────────────────────────────────────────
// MAIN SEED
// ─────────────────────────────────────────────

async function main() {
  // 1. Permissions and roles

  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }

  const allPerms = await prisma.permission.findMany();

  const permId = new Map(
    allPerms.map((permission) => [
      permission.key,
      permission.id,
    ])
  );

  for (const [name, definition] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {
        description: definition.description,
      },
      create: {
        name,
        description: definition.description,
      },
    });

    await prisma.rolePermission.createMany({
      data: definition.permissions.map((permissionKey) => ({
        roleId: role.id,
        permissionId: permId.get(permissionKey)!,
      })),
      skipDuplicates: true,
    });
  }

  // 2. Main categories

  const cat = async (
    slug: string,
    name: string,
    sortOrder: number,
    parentId?: string
  ) =>
    prisma.category.upsert({
      where: { slug },
      update: {
        name,
        sortOrder,
        parentId,
      },
      create: {
        slug,
        name,
        sortOrder,
        parentId,
      },
    });

  const seafood = await cat("seafood", "Seafood", 1);
  const chicken = await cat("chicken", "Chicken", 2);

  await cat("fish", "Fish", 1, seafood.id);
  await cat("crab", "Crab", 2, seafood.id);
  await cat("prawns", "Prawns", 3, seafood.id);

  // 3. Chicken categories

  const chickenCats: [string, string][] = [
    ["chicken-strips", "Chicken Strips"],
    ["chicken-wings", "Chicken Wings"],
    ["chicken-lollipops", "Chicken Lollipops"],
  ];

  for (const [index, [slug, name]] of chickenCats.entries()) {
    await cat(slug, name, index + 1, chicken.id);
  }

  // 4. Retire old chicken placeholder products.
  // Preserve their records and relationships.

  const retiredChickenSlugs = [
    "chicken-breast",
    "chicken-leg-piece",
    "chicken-thigh",
    "boneless-chicken",
    "chicken-curry-cut",
  ];

  await prisma.product.updateMany({
    where: {
      slug: { in: retiredChickenSlugs },
      isPlaceholder: true,
      isActive: true,
    },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
  });

  // Deactivate old chicken categories only if they have
  // no active, verified products remaining.

  await prisma.category.updateMany({
    where: {
      slug: { in: retiredChickenSlugs },
      isActive: true,
      products: {
        none: {
          isActive: true,
          isPlaceholder: false,
          deletedAt: null,
        },
      },
    },
    data: {
      isActive: false,
    },
  });

  // 5. Cut options

  const cutNames = [
    "Whole, cleaned",
    "Curry cut",
    "Fillet",
    "Cleaned & cut",
    "Peeled & deveined",
    "Shell-on",
  ];

  for (const name of cutNames) {
    await prisma.cutOption.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // 6. Outlets

  const outletA = await prisma.outlet.upsert({
    where: { code: "OUTLET_A" },
    update: {},
    create: {
      code: "OUTLET_A",
      name: "Outlet A (placeholder)",
      city: "Mysuru",
    },
  });

  const outletB = await prisma.outlet.upsert({
    where: { code: "OUTLET_B" },
    update: {},
    create: {
      code: "OUTLET_B",
      name: "Outlet B (placeholder)",
      city: "Mysuru",
    },
  });

  // 7. Products, variants, cuts and inventory

  const demoStock =
    process.env.SEED_DEMO_STOCK === "true";

  for (const item of products) {
    const category = await prisma.category.findUniqueOrThrow({
      where: { slug: item.category },
    });

    const product = await prisma.product.upsert({
      where: { slug: item.slug },

      // Update catalogue information without overwriting
      // source verification or existing stock-related records.
      update: {
        name: item.name,
        categoryId: category.id,
        isPlaceholder: item.isPlaceholder,
      },

      create: {
        slug: item.slug,
        name: item.name,
        categoryId: category.id,
        isActive: true,
        isPlaceholder: item.isPlaceholder,
        description: item.isPlaceholder
          ? "Unidentified fish placeholder — Super Admin only."
          : null,
      },
    });

    // Update existing weight variants and prices.
    for (const weightGrams of item.weights) {
      const pricePaise = priceFor(
        weightGrams,
        item.pricePerKgPaise
      );

      const label =
        weightGrams >= 1000
          ? `${weightGrams / 1000} kg`
          : `${weightGrams} g`;

      const sku = `${item.slug}-${weightGrams}g`;

      await prisma.productVariant.upsert({
        where: {
          productId_weightGrams: {
            productId: product.id,
            weightGrams,
          },
        },

        update: {
          sku,
          label,
          pricePaise,
        },

        create: {
          productId: product.id,
          weightGrams,
          label,
          sku,
          pricePaise,
        },
      });
    }

    // Product cut relationships.

    for (const cutName of item.cuts) {
      const cut = await prisma.cutOption.findUniqueOrThrow({
        where: { name: cutName },
      });

      await prisma.productCutOption.upsert({
        where: {
          productId_cutOptionId: {
            productId: product.id,
            cutOptionId: cut.id,
          },
        },

        update: {},

        create: {
          productId: product.id,
          cutOptionId: cut.id,
        },
      });
    }

    // Inventory rows.
    // Existing inventory quantities are NOT overwritten.

    for (const [outlet, demoGrams] of [
      [outletA, 8000],
      [outletB, 5000],
    ] as const) {
      await prisma.inventory.upsert({
        where: {
          outletId_productId: {
            outletId: outlet.id,
            productId: product.id,
          },
        },

        update: {},

        create: {
          outletId: outlet.id,
          productId: product.id,
          onHandGrams: demoStock ? demoGrams : 0,
        },
      });
    }
  }

  // 8. Site settings

  const settings: Record<string, unknown> = {
    cod_enabled: false,

    reservation_minutes: 15,

    delivery_fee: {
      mode: "flat",
      flatPaise: 0,
      note: "Placeholder until business decides.",
    },
  };

  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: {},
      create: {
        key,
        value: value as object,
      },
    });
  }

  console.log("\nCHOPERZ FRESH seed completed.");
  console.log(`Catalogue products configured: ${products.length}`);
  console.log("Confirmed products: 15");
  console.log("Hidden fish placeholders: 2");
  console.log("Retired chicken placeholders preserved.");
  console.log("Source verification remains separate.");
  console.log(
    demoStock
      ? "Demo stock enabled."
      : "Inventory created without demo stock."
  );
}

// ─────────────────────────────────────────────
// EXECUTION
// ─────────────────────────────────────────────

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
