
import type { Metadata } from "next";
import { Suspense } from "react";

import { SmoothScroll } from "@/components/storefront/smooth-scroll";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { ProductCatalogue } from "@/components/storefront/product-catalogue";

export const metadata: Metadata = {
  title: "Shop Seafood & Chicken | Choperz Fresh",
  description:
    "Explore fresh seafood, fish, prawns, crabs and chicken at Choperz Fresh.",
};

type SearchParams = {
  q?: string | string[];
  category?: string | string[];
};

type ProductsPageProps = {
  searchParams: Promise<SearchParams>;
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function CatalogueContent({
  searchParams,
}: ProductsPageProps) {
  const params = await searchParams;

  const initialQuery = firstValue(params.q) ?? "";
  const initialCategory = firstValue(params.category) ?? "";

  return (
    <SmoothScroll>
      <StorefrontHeader />
      <ProductCatalogue
        initialQuery={initialQuery}
        initialCategory={initialCategory}
      />
    </SmoothScroll>
  );
}

export default function ProductsPage(props: ProductsPageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F6F3EA]">
          <p className="text-sm font-medium text-[#60717A]">
            Preparing the Choperz market...
          </p>
        </main>
      }
    >
      <CatalogueContent {...props} />
    </Suspense>
  );
}
