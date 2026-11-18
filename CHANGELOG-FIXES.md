# Order lifecycle fixes

This patch updates the six files from the supplied ZIP and adds one COD payment endpoint.

## Changes

- Super Admin cancellation is limited to `pending`, `confirmed`, `processing`, and `packed`. Once pickup has occurred, cancellation is rejected and must use a return workflow.
- Cancellation is blocked unless payment status is `UNPAID` or `FAILED`, pending a dedicated refund/reconciliation workflow.
- Customer cancellation follows the same payment-state guard.
- Non-Super-Admin order detail and status operations are now scoped to the staff member's assigned outlet, including Order Managers.
- Added `POST /api/admin/orders/:orderId/payment` to explicitly confirm COD cash collection after delivery. It creates a `Payment` record with provider `cod_cash`, updates the order to PAID, and writes an audit log. It is Super Admin-only and idempotent for already-paid orders.

## COD cash collection request

```json
{
  "action": "confirm_cod_cash_collected",
  "note": "Cash received by delivery staff"
}
```

## Validation status

The patch was reviewed against the Prisma schema on branch `feat/order-lifecycle-hardening`. The supplied ZIP does not include the complete project, dependencies, generated Prisma client, or test suite, so a full TypeScript build and integration test could not be run here. Run the repository's `npx tsc --noEmit`, lint, and targeted API tests after applying this patch.
