
import type { Metadata } from "next";

import { SmoothScroll } from "@/components/storefront/smooth-scroll";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { CheckoutPage } from "@/components/storefront/checkout-page";

export const metadata: Metadata = {
  title: "Checkout | Choperz Fresh",
  description:
    "Choose your delivery address and place your Choperz Fresh order.",
};

export default function CheckoutRoute() {
  return (
    <SmoothScroll>
      <StorefrontHeader />
      <CheckoutPage />
    </SmoothScroll>
  );
}
