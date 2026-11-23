import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaffPermissions } from "@/lib/authorization";

type RouteContext = { params: Promise<{ supplierId: string }> };
const schema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  location: z.string().trim().max(200).nullable().optional(),
  contact: z.string().trim().max(100).nullable().optional(),
  isActive: z.boolean().optional(),
}).strict().refine(data => Object.keys(data).length > 0);

export async function PATCH(request: Request, context: RouteContext) {
  const access = await requireStaffPermissions(["suppliers.write"]);
  if (!access.authorized) {
    return NextResponse.json({ success: false, error: access.message }, { status: access.status });
  }
  const { supplierId } = await context.params;
  if (!supplierId || supplierId.length > 100) {
    return NextResponse.json({ success: false, error: "A valid supplier ID is required." }, { status: 400 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON request body." }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid supplier update.", details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const before = await tx.supplier.findUnique({ where: { id: supplierId } });
      if (!before) return null;
      const supplier = await tx.supplier.update({ where: { id: supplierId }, data: parsed.data });
      await tx.auditLog.create({
        data: {
          actorId: access.userId,
          action: "SUPPLIER_UPDATED",
          entity: "Supplier",
          entityId: supplierId,
          before: { name: before.name, location: before.location, contact: before.contact, isActive: before.isActive },
          after: { name: supplier.name, location: supplier.location, contact: supplier.contact, isActive: supplier.isActive },
        },
      });
      return supplier;
    });
    if (!updated) return NextResponse.json({ success: false, error: "Supplier not found." }, { status: 404 });
    return NextResponse.json({ success: true, message: "Supplier updated successfully.", supplier: updated });
  } catch (error) {
    console.error("Admin supplier update failed:", error);
    return NextResponse.json({ success: false, error: "Unable to update supplier." }, { status: 500 });
  }
}
