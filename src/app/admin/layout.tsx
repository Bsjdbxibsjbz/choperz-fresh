import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "./admin-shell";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login?callbackUrl=%2Fadmin");

  const staff = await prisma.staffProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      isActive: true,
      outletId: true,
      role: {
        select: {
          name: true,
          permissions: { select: { permission: { select: { key: true } } } },
        },
      },
      user: { select: { name: true, phoneNumber: true, kind: true } },
    },
  });

  if (!staff || !staff.isActive || staff.user.kind !== "STAFF") redirect("/");
  const permissions = staff.role.permissions.map((item) => item.permission.key);

  return (
    <AdminShell
      name={staff.user.name}
      phoneNumber={staff.user.phoneNumber ?? ""}
      role={staff.role.name}
      outletId={staff.outletId}
      permissions={permissions}
    >
      {children}
    </AdminShell>
  );
}
