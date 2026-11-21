-- Choperz Fresh no longer uses inventory reservations.
-- Keep the legacy column for compatibility with the current Prisma schema, but clear all old values.
UPDATE "inventory" SET "reservedGrams" = 0 WHERE "reservedGrams" <> 0;
