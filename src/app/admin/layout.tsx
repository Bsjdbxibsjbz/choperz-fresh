import { Suspense, type ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "./admin-shell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AdminLoadingFallback />}>
      <AdminAccessGate>{children}</AdminAccessGate>
    </Suspense>
  );
}

async function AdminAccessGate({ children }: { children: ReactNode }) {
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

function AdminLoadingFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F4F6F2] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-[#DDE5DF] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto size-10 animate-pulse rounded-xl bg-[#DCECE5]" />
        <p className="mt-4 text-sm font-bold text-[#102D38]">Opening secure workspace</p>
        <p className="mt-2 text-xs text-[#829089]">Verifying your staff access…</p>
      </div>
    </main>
  );
}
