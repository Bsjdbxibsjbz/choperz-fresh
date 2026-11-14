import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// ── Permissions & roles ─────────────────────────────────────────────
const PERMISSIONS = [
  "products.read", "products.write", "categories.write", "prices.write", "images.write",
  "inventory.read", "inventory.adjust", "inventory.transfer",
  "suppliers.write", "batches.write",
  "orders.read", "orders.update_status",
  "payments.read", "refunds.write",
  "customers.read",
  "recipes.write", "content.write",
  "outlets.write", "zones.write",
  "staff.manage", "roles.manage",
  "reports.read", "settings.write", "audit.read",
] as const;

const ROLES: Record<string, { description: string; permissions: readonly string[] }> = {
  SUPER_ADMIN: { description: "Full system access", permissions: PERMISSIONS },
  INVENTORY_MANAGER: {
    description: "Central inventory, suppliers, batches, transfers, adjustments",
    permissions: ["inventory.read", "inventory.adjust", "inventory.transfer", "suppliers.write", "batches.write", "products.read"],
  },
  OUTLET_MANAGER: {
    description: "Assigned outlet inventory and orders (scoped by staff_profiles.outletId)",
    permissions: ["inventory.read", "inventory.adjust", "orders.read", "orders.update_status", "products.read"],
  },
  PRODUCT_MANAGER: {
    description: "Products, categories, variants, prices, photographs",
    permissions: ["products.read", "products.write", "categories.write", "prices.write", "images.write"],
  },
  ORDER_MANAGER: {
    description: "View and process permitted orders",
    permissions: ["orders.read", "orders.update_status", "products.read"],
  },
  CONTENT_MANAGER: {
    description: "Product descriptions, recipes, recipe links",
    permissions: ["products.read", "recipes.write", "content.write"],
  },
};

// ── Catalog (ALL PLACEHOLDERS — no real species, claims or prices) ──
const DEMO_PRICE_PER_KG_PAISE = 40000; // sample price only; real prices set in admin
const priceFor = (grams: number) => Math.round((grams / 1000) * DEMO_PRICE_PER_KG_PAISE);

type Seed = { slug: string; name: string; category: string; weights: number[]; cuts: string[] };

const products: Seed[] = [
  ...Array.from({ length: 12 }, (_, i): Seed => {
    const n = String(i + 1).padStart(2, "0");
    return { slug: `fish-placeholder-${n}`, name: `Fish Placeholder ${n}`, category: "fish", weights: [500, 1000], cuts: ["Whole, cleaned", "Curry cut", "Fillet"] };
  }),
  { slug: "crab-placeholder", name: "Crab Placeholder", category: "crab", weights: [500, 1000], cuts: ["Cleaned & cut"] },
  { slug: "prawn-placeholder", name: "Prawn Placeholder", category: "prawns", weights: [250, 500], cuts: ["Peeled & deveined", "Shell-on"] },
  { slug: "chicken-breast", name: "Chicken Breast", category: "chicken-breast", weights: [500, 1000], cuts: [] },
  { slug: "chicken-leg-piece", name: "Chicken Leg Piece", category: "chicken-leg-piece", weights: [500, 1000], cuts: [] },
  { slug: "chicken-thigh", name: "Chicken Thigh", category: "chicken-thigh", weights: [500, 1000], cuts: [] },
  { slug: "boneless-chicken", name: "Boneless Chicken", category: "boneless-chicken", weights: [500, 1000], cuts: [] },
  { slug: "chicken-curry-cut", name: "Chicken Curry Cut", category: "chicken-curry-cut", weights: [500, 1000], cuts: [] },
];

async function main() {
  // Permissions + roles
  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
  const allPerms = await prisma.permission.findMany();
  const permId = new Map(allPerms.map((p) => [p.key, p.id]));
  for (const [name, def] of Object.entries(ROLES)) {
    const role = await prisma.role.upsert({
      where: { name }, update: { description: def.description }, create: { name, description: def.description },
    });
    await prisma.rolePermission.createMany({
      data: def.permissions.map((k) => ({ roleId: role.id, permissionId: permId.get(k)! })),
      skipDuplicates: true,
    });
  }

  // Categories
  const cat = async (slug: string, name: string, sortOrder: number, parentId?: string) =>
    prisma.category.upsert({ where: { slug }, update: { name, sortOrder, parentId }, create: { slug, name, sortOrder, parentId } });
  const seafood = await cat("seafood", "Seafood", 1);
  const chicken = await cat("chicken", "Chicken", 2);
  await cat("fish", "Fish", 1, seafood.id);
  await cat("crab", "Crab", 2, seafood.id);
  await cat("prawns", "Prawns", 3, seafood.id);
  const chickenCats: [string, string][] = [
    ["chicken-breast", "Chicken Breast"], ["chicken-leg-piece", "Chicken Leg Piece"],
    ["chicken-thigh", "Chicken Thigh"], ["boneless-chicken", "Boneless Chicken"], ["chicken-curry-cut", "Chicken Curry Cut"],
  ];
  for (const [i, [slug, name]] of chickenCats.entries()) await cat(slug, name, i + 1, chicken.id);

  // Cut options
  const cutNames = ["Whole, cleaned", "Curry cut", "Fillet", "Cleaned & cut", "Peeled & deveined", "Shell-on"];
  for (const name of cutNames) await prisma.cutOption.upsert({ where: { name }, update: {}, create: { name } });

  // Outlets (placeholders; coordinates intentionally null until verified)
  const outletA = await prisma.outlet.upsert({ where: { code: "OUTLET_A" }, update: {}, create: { code: "OUTLET_A", name: "Outlet A (placeholder)", city: "Mysuru" } });
  const outletB = await prisma.outlet.upsert({ where: { code: "OUTLET_B" }, update: {}, create: { code: "OUTLET_B", name: "Outlet B (placeholder)", city: "Mysuru" } });

  // Products, variants, cut links, inventory rows
  const demoStock = process.env.SEED_DEMO_STOCK === "true";
  for (const p of products) {
    const category = await prisma.category.findUniqueOrThrow({ where: { slug: p.category } });
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: { slug: p.slug, name: p.name, categoryId: category.id, isPlaceholder: true, description: "Details pending verification." },
    });
    for (const w of p.weights) {
      await prisma.productVariant.upsert({
        where: { productId_weightGrams: { productId: product.id, weightGrams: w } },
        update: {},
        create: { productId: product.id, weightGrams: w, label: w >= 1000 ? `${w / 1000} kg` : `${w} g`, sku: `${p.slug}-${w}g`, pricePaise: priceFor(w) },
      });
    }
    for (const c of p.cuts) {
      const cut = await prisma.cutOption.findUniqueOrThrow({ where: { name: c } });
      await prisma.productCutOption.upsert({
        where: { productId_cutOptionId: { productId: product.id, cutOptionId: cut.id } }, update: {}, create: { productId: product.id, cutOptionId: cut.id },
      });
    }
    for (const [outlet, grams] of [[outletA, 8000], [outletB, 5000]] as const) {
      await prisma.inventory.upsert({
        where: { outletId_productId: { outletId: outlet.id, productId: product.id } },
        update: {},
        create: { outletId: outlet.id, productId: product.id, onHandGrams: demoStock ? grams : 0 },
      });
    }
  }

  // Settings
  const settings: Record<string, unknown> = {
    cod_enabled: false,
    reservation_minutes: 15,
    delivery_fee: { mode: "flat", flatPaise: 0, note: "placeholder until business decides" },
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({ where: { key }, update: {}, create: { key, value: value as object } });
  }
  console.log("Seed complete.", demoStock ? "(demo stock added)" : "(zero stock)");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
