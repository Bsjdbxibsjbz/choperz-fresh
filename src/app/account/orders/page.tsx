import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { CustomerOrders } from "@/components/storefront/customer-orders";
import { SmoothScroll } from "@/components/storefront/smooth-scroll";
import { StorefrontHeader } from "@/components/storefront/storefront-header";

export const metadata: Metadata = {
  title: "Your Orders | Choperz Fresh",
  description: "Track your Choperz Fresh orders and review past purchases.",
};

export default function CustomerOrdersPage() {
  return (
    <Suspense fallback={<OrdersPageFallback />}>
      <CustomerOrdersContent />
    </Suspense>
  );
}

async function CustomerOrdersContent() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Staff accounts use the operations workspace, not customer order history.
  if (session?.user.kind === "STAFF") {
    redirect("/admin");
  }

  return (
    <SmoothScroll>
      <StorefrontHeader />
      <CustomerOrders />
    </SmoothScroll>
  );
}

function OrdersPageFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F3EA] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-[#E2E4D9] bg-white p-8 text-center">
        <p className="font-[family-name:var(--font-manrope)] text-lg font-extrabold text-[#102D38]">
          CHOPERZ<span className="text-[#168477]">.</span>
        </p>
        <p className="mt-3 text-sm text-[#71817D]">Loading your orders…</p>
      </div>
    </main>
  );
}
