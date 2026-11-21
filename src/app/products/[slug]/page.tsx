
import type { Metadata } from "next";
import { Suspense } from "react";

import { SmoothScroll } from "@/components/storefront/smooth-scroll";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { ProductDetails } from "@/components/storefront/product-details";

export const metadata: Metadata = {
  title: "Product Details | Choperz Fresh",
  description:
    "Explore product details, available weights and cutting preferences at Choperz Fresh.",
};

type ProductPageProps = {
  params: Promise<{ slug: string }>;
};

async function ProductContent({ params }: ProductPageProps) {
  const { slug } = await params;

  return <ProductDetails slug={slug} />;
}

export default function ProductPage(props: ProductPageProps) {
  return (
    <SmoothScroll>
      <StorefrontHeader />

      <Suspense
        fallback={
          <main className="flex min-h-[65vh] items-center justify-center bg-[#F6F3EA]">
            <p className="text-sm font-medium text-[#60717A]">
              Preparing your product...
            </p>
          </main>
        }
      >
        <ProductContent params={props.params} />
      </Suspense>
    </SmoothScroll>
  );
}
