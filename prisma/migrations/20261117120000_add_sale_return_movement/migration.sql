-- Distinguish stock returned after an admin cancellation from other adjustments.
ALTER TYPE "MovementType" ADD VALUE IF NOT EXISTS 'SALE_RETURN';
