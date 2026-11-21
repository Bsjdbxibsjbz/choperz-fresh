
"use client";

import { useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Drumstick,
  Fish,
  ShoppingBag,
} from "lucide-react";

type ProductVariant = {
  id: string;
  label: string;
  weightGrams: number;
  pricePaise: number | null;
};

type ProductCut = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  slug: string;
  name: string;
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK";
  category: {
    slug: string;
    name: string;
  };
  variants: ProductVariant[];
  images: {
    url: string;
    alt: string;
  }[];
  cutOptions: ProductCut[];
};

type Filter = "all" | "seafood" | "chicken";

function isChicken(product: Product) {
  return (
    product.category.slug.startsWith("chicken") ||
    product.category.name.toLowerCase().includes("chicken")
  );
}

function formatPrice(pricePaise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(pricePaise / 100);
}

function ProductArtwork({ product }: { product: Product }) {
  const isChickenProduct = isChicken(product);

  const fallbackImage = product.name.toLowerCase().includes("prawn")
    ? "/images/storefront/prawns.jpg"
    : "/images/storefront/fish-market.jpg";

  const imageUrl = product.images[0]?.url || (
    isChickenProduct ? null : fallbackImage
  );

  if (imageUrl) {
    return (
      <div
        role="img"
        aria-label={product.images[0]?.alt || `${product.name} product photograph`}
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
        style={{
          backgroundImage: `linear-gradient(to top, rgba(16,45,56,0.35), transparent 55%), url("${imageUrl}")`,
        }}
      />
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1C414C] via-[#102D38] to-[#168477]/40">
      <div className="flex size-32 items-center justify-center rounded-full border border-[#8FB8A9]/20 bg-[#DCECE5] text-[#102D38] shadow-2xl transition-transform duration-500 group-hover:scale-110">
        {isChickenProduct ? (
          <Drumstick className="size-16" strokeWidth={1.2} />
        ) : (
          <Fish className="size-16" strokeWidth={1.2} />
        )}
      </div>
      <span className="mt-4 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#DCECE5]/80">
        Choperz Fresh
      </span>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const [variantId, setVariantId] = useState(
    product.variants[0]?.id ?? ""
  );
  const [cutOptionId, setCutOptionId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [feedback, setFeedback] = useState("");

  const selectedVariant = product.variants.find(
    (variant) => variant.id === variantId
  );

  const inStock = product.stockStatus === "IN_STOCK";

  async function addToCart() {
    if (!selectedVariant || !inStock || isAdding) return;

    setIsAdding(true);
    setFeedback("");

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variantId: selectedVariant.id,
          quantity: 1,
          cutOptionId: cutOptionId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setFeedback(
          response.status === 401
            ? "Please sign in to add this item."
            : data.error || "Unable to add this product."
        );
        return;
      }

      setFeedback("Added to your cart!");
      window.dispatchEvent(new Event("choperz:cart-updated"));
    } catch {
      setFeedback("Something went wrong. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <article className="group min-w-0 overflow-hidden rounded-[22px] border border-[#D8E1DC] bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#102D38]/8">
      {/* Product photograph */}
      <div className="relative isolate aspect-[4/3] overflow-hidden bg-[#DCECE5]">
        <ProductArtwork product={product} />

        <div className="absolute left-4 top-4">
          {inStock ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#DCECE5] px-3 py-1.5 text-[10px] font-bold text-[#102D38]">
              <span className="size-1.5 rounded-full bg-[#168477]" />
              AVAILABLE
            </span>
          ) : (
            <span className="rounded-full bg-[#102D38]/85 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur-md">
              OUT OF STOCK
            </span>
          )}
        </div>

        <div className="absolute bottom-4 right-4 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-semibold text-[#102D38] backdrop-blur-md">
          {product.category.name}
        </div>
      </div>

      {/* Product information */}
      <div className="p-5">
        <h3 className="font-[family-name:var(--font-manrope)] text-lg font-bold tracking-tight text-[#102D38]">
          {product.name}
        </h3>

        <p className="mt-1 text-[11px] text-[#8A9998]">
          Carefully selected by Choperz Fresh
        </p>

        <div className="mt-5 space-y-3">
          {product.variants.length > 1 ? (
            <div>
              <label
                htmlFor={`variant-${product.id}`}
                className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#60717A]"
              >
                Select weight
              </label>
              <select
                id={`variant-${product.id}`}
                value={variantId}
                onChange={(event) => {
                  setVariantId(event.target.value);
                  setFeedback("");
                }}
                className="h-10 w-full rounded-lg border border-[#D8E1DC] bg-[#F6F3EA] px-3 text-xs font-medium text-[#102D38] outline-none focus:border-[#168477]"
              >
                {product.variants.map((variant) => (
                  <option key={variant.id} value={variant.id}>
                    {variant.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex h-10 items-center justify-between rounded-lg bg-[#F6F3EA] px-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#60717A]">
                Weight
              </span>
              <span className="text-xs font-semibold text-[#102D38]">
                {selectedVariant?.label || "Unavailable"}
              </span>
            </div>
          )}

          {product.cutOptions.length > 0 && (
            <div>
              <label
                htmlFor={`cut-${product.id}`}
                className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#60717A]"
              >
                Cutting preference
              </label>
              <select
                id={`cut-${product.id}`}
                value={cutOptionId}
                onChange={(event) => {
                  setCutOptionId(event.target.value);
                  setFeedback("");
                }}
                className="h-10 w-full rounded-lg border border-[#D8E1DC] bg-[#F6F3EA] px-3 text-xs font-medium text-[#102D38] outline-none focus:border-[#168477]"
              >
                <option value="">No preference</option>
                {product.cutOptions.map((cut) => (
                  <option key={cut.id} value={cut.id}>
                    {cut.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-[#E8EDE9] pt-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-wider text-[#8A9998]">
              Starting at
            </p>
            <p className="mt-1 font-[family-name:var(--font-manrope)] text-xl font-extrabold text-[#102D38]">
              {selectedVariant?.pricePaise != null
                ? formatPrice(selectedVariant.pricePaise)
                : "Price unavailable"}
            </p>
          </div>

          <button
            type="button"
            disabled={!inStock || !selectedVariant || isAdding}
            onClick={addToCart}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#168477] px-4 text-xs font-bold text-white transition-all hover:bg-[#102D38] disabled:cursor-not-allowed disabled:bg-[#D8E1DC] disabled:text-[#60717A]"
          >
            {isAdding ? (
              "Adding..."
            ) : feedback === "Added to your cart!" ? (
              <>
                <Check className="size-4" />
                Added
              </>
            ) : (
              <>
                <ShoppingBag className="size-4" />
                Add
              </>
            )}
          </button>
        </div>

        {feedback && (
          <p
            role="status"
            className="mt-3 text-[11px] font-medium text-[#168477]"
          >
            {feedback}
          </p>
        )}
      </div>
    </article>
  );
}

export function ProductShowcase() {
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    slidesToScroll: 1,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadProducts() {
      try {
        const response = await fetch("/api/products?limit=50");
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Unable to load products.");
        }

        const sortedProducts = [...data.products].sort(
          (a, b) =>
            Number(b.stockStatus === "IN_STOCK") -
            Number(a.stockStatus === "IN_STOCK")
        );

        if (!cancelled) {
          setProducts(sortedProducts);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load the catalogue."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    if (filter === "all") return products;

    return products.filter((product) =>
      filter === "chicken"
        ? isChicken(product)
        : !isChicken(product)
    );
  }, [products, filter]);

  useEffect(() => {
    emblaApi?.reInit();
  }, [emblaApi, filteredProducts.length]);

  const filters: { label: string; value: Filter }[] = [
    { label: "Everything", value: "all" },
    { label: "Seafood", value: "seafood" },
    { label: "Chicken", value: "chicken" },
  ];

  return (
    <section className="overflow-hidden bg-white px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1280px]">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#168477]">
              THE MARKET AT CHOPERZ
            </p>

            <h2 className="mt-4 font-[family-name:var(--font-manrope)] text-3xl font-extrabold tracking-[-0.055em] text-[#102D38] sm:text-4xl lg:text-5xl">
              Pick something fresh.
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#60717A]">
              Browse our collection of seafood and chicken favourites.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filters.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                aria-pressed={filter === item.value}
                className={`rounded-full px-5 py-2.5 text-xs font-semibold transition-colors ${
                  filter === item.value
                    ? "bg-[#102D38] text-white"
                    : "border border-[#D8E1DC] bg-[#F6F3EA] text-[#50636A] hover:border-[#168477] hover:text-[#168477]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-[420px] animate-pulse rounded-[22px] bg-[#F6F3EA]"
              />
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="mt-10 rounded-2xl border border-[#D8E1DC] bg-[#F6F3EA] p-8 text-center">
            <p className="font-semibold text-[#102D38]">
              We couldn't load the catalogue.
            </p>
            <p className="mt-2 text-sm text-[#60717A]">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-full bg-[#102D38] px-5 py-3 text-xs font-bold text-white"
            >
              Try again
            </button>
          </div>
        )}

        {/* Product carousel */}
        {!loading && !error && filteredProducts.length > 0 && (
          <>
            <div className="mt-10 overflow-hidden" ref={emblaRef}>
              <div className="-ml-4 flex">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="min-w-0 flex-[0_0_88%] pl-4 sm:flex-[0_0_48%] lg:flex-[0_0_32%] xl:flex-[0_0_25%]"
                  >
                    <ProductCard product={product} />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between">
              <p className="text-xs text-[#60717A]">
                Showing {filteredProducts.length} products
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => emblaApi?.scrollPrev()}
                  aria-label="Previous products"
                  className="flex size-11 items-center justify-center rounded-full border border-[#D8E1DC] text-[#102D38] transition-colors hover:bg-[#DCECE5]"
                >
                  <ArrowLeft className="size-4" />
                </button>

                <button
                  type="button"
                  onClick={() => emblaApi?.scrollNext()}
                  aria-label="Next products"
                  className="flex size-11 items-center justify-center rounded-full bg-[#102D38] text-white transition-colors hover:bg-[#168477]"
                >
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </div>
          </>
        )}

        {!loading && !error && filteredProducts.length === 0 && (
          <p className="mt-10 rounded-2xl bg-[#F6F3EA] p-8 text-center text-sm text-[#60717A]">
            No products found in this collection yet.
          </p>
        )}
      </div>
    </section>
  );
}
