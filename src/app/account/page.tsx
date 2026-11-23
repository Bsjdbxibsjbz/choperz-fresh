import type { Metadata } from "next";
import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { CustomerAccount } from "@/components/storefront/customer-account";
import { SmoothScroll } from "@/components/storefront/smooth-scroll";
import { StorefrontHeader } from "@/components/storefront/storefront-header";

export const metadata: Metadata = {
  title: "My Account | Choperz Fresh",
  description: "Manage your Choperz Fresh customer account.",
};

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountLoadingFallback />}>
      <AccountPageContent />
    </Suspense>
  );
}

async function AccountPageContent() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Staff users have a separate operations workspace, not a customer profile.
  if (session?.user.kind === "STAFF") {
    redirect("/admin");
  }

  return (
    <SmoothScroll>
      <StorefrontHeader />
      <CustomerAccount />
    </SmoothScroll>
  );
}

function AccountLoadingFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F6F3EA] px-6">
      <div className="w-full max-w-sm rounded-2xl border border-[#E2E4D9] bg-white p-8 text-center">
        <p className="font-[family-name:var(--font-manrope)] text-lg font-extrabold text-[#102D38]">
          CHOPERZ<span className="text-[#168477]">.</span>
        </p>
        <p className="mt-3 text-sm text-[#71817D]">Checking your account…</p>
      </div>
    </main>
  );
}
