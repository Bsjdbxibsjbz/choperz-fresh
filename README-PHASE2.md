# Choperz Fresh — Phase 2 setup (Windows, native PostgreSQL, no Docker)

## 0. Prerequisites
- Node.js LTS, Git, VS Code
- PostgreSQL for Windows (EDB installer). Remember the `postgres` password you set.

## 1. Create the database
Open "SQL Shell (psql)" (or `psql -U postgres`) and run:
```sql
CREATE DATABASE choperz_fresh;
```

## 2. Scaffold Next.js
```powershell
npx create-next-app@latest choperz-fresh --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cd choperz-fresh
```
Accept defaults for any other prompts.

## 3. Install dependencies (Prisma 7.x — keep all three on the same 7.x version)
```powershell
npm i -D prisma@7 tsx @types/pg
npm i @prisma/client@7 @prisma/adapter-pg pg dotenv zod server-only
```
> `npm i prisma` without `@7` may currently pull a pre-release 8.x with different commands.

## 4. Copy these files into your project (same relative paths)
- `prisma/schema.prisma`, `prisma/seed.ts`
- `prisma.config.ts`   (project root)
- `src/lib/prisma.ts`
- `.env.example` → copy to `.env`, then set your real password in `DATABASE_URL`

Add to `.gitignore`:
```
.env
src/generated/
```
Add scripts to `package.json`:
```powershell
npm pkg set scripts.postinstall="prisma generate" scripts.db:migrate="prisma migrate dev" scripts.db:seed="prisma db seed" scripts.db:studio="prisma studio" scripts.db:reset="prisma migrate reset"
```

## 5. Migrate (with DB-level safety checks)
```powershell
npx prisma migrate dev --name init --create-only
```
Open the new `prisma/migrations/<timestamp>_init/migration.sql` and append this at the end:
```sql
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_grams_check"
  CHECK ("onHandGrams" >= 0 AND "reservedGrams" >= 0 AND "reservedGrams" <= "onHandGrams");
ALTER TABLE "product_variants" ADD CONSTRAINT "variant_positive_check"
  CHECK ("weightGrams" > 0 AND "pricePaise" >= 0);
ALTER TABLE "order_items" ADD CONSTRAINT "order_item_qty_check" CHECK ("quantity" > 0);
```
Then apply and seed:
```powershell
npx prisma migrate dev
npm run db:seed
```
For demo stock (8000 g Outlet A / 5000 g Outlet B per product), set `SEED_DEMO_STOCK="true"` in `.env` first (dev only).

## 6. Verify
```powershell
npm run db:studio     # browse tables
npm run dev           # http://localhost:3000
```
Expected after seeding: 6 roles, 24 permissions, 10 categories, 19 products, 2 outlets, 38 inventory rows, 38 variants.
