import type { Metadata } from "next";

import { CustomerAccount } from "@/components/storefront/customer-account";
import { SmoothScroll } from "@/components/storefront/smooth-scroll";
import { StorefrontHeader } from "@/components/storefront/storefront-header";

export const metadata: Metadata = {
  title: "My Account | Choperz Fresh",
  description: "Manage your Choperz Fresh customer account.",
};

export default function AccountPage() {
  return (
    <SmoothScroll>
      <StorefrontHeader />
      <CustomerAccount />
    </SmoothScroll>
  );
}
