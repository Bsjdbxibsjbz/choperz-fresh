import type { Metadata } from "next";

import { CartPage } from "@/components/storefront/cart-page";
import { SmoothScroll } from "@/components/storefront/smooth-scroll";
import { StorefrontHeader } from "@/components/storefront/storefront-header";

export const metadata: Metadata = {
  title: "Your Cart | Choperz Fresh",
  description: "Review your fresh seafood and meat selection.",
};

export default function CartRoute() {
  return (
    <SmoothScroll>
      <StorefrontHeader />
      <CartPage />
    </SmoothScroll>
  );
}