
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Drumstick,
  Fish,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Truck,
} from "lucide-react";

type ProductVariant = {
  id: string;
  label: string;
  weightGrams: number;
  pricePaise: number;
};

type ProductImage = {
  id: string;
  url: string;
  kind: string;
  alt: string;
  sortOrder: number;
};

type ProductCutOption = {
  id: string;
  name: string;
};

type ProductNutrition = {
  energyKcal: number | null;
  proteinG: number | null;
  fatG: number | null;
  carbsG: number | null;
  source: string | null;
} | null;

type Product = {
  id: string;
  slug: string;
  name: string;
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK";
  localName: string | null;
  englishName: string | null;
  scientificName: string | null;
  description: string | null;
  sourceInfo: string | null;
  storageInstructions: string | null;
  isSourceVerified: boolean;
  category: {
    slug: string;
    name: string;
    parent: {
      slug: string;
      name: string;
    } | null;
  };
  variants: ProductVariant[];
  images: ProductImage[];
  nutrition: ProductNutrition;
  cutOptions: ProductCutOption[];
};

type ProductResponse = {
  success?: boolean;
  error?: string;
  product?: Product;
};

const formatPrice = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);

function formatWeight(grams: number) {
  return grams >= 1000
    ? `${grams / 1000} kg`
    : `${grams} g`;
}

function ProductFallback({ chicken }: { chicken: boolean }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center bg-gradient-to-br from-[#1C414C] via-[#102D38] to-[#168477]/50 sm:min-h-[480px]">
      <div className="flex size-32 items-center justify-center rounded-full border border-[#8FB8A9]/30 bg-[#DCECE5] text-[#102D38] shadow-2xl sm:size-40">
        {chicken ? (
          <Drumstick className="size-20" strokeWidth={1.1} />
        ) : (
          <Fish className="size-20" strokeWidth={1.1} />
        )}
      </div>
      <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.25em] text-[#DCECE5]/80">
        Choperz Fresh
      </p>
      <p className="mt-2 text-sm text-white/70">
        Freshness with care
      </p>
    </div>
  );
}

export function ProductDetails({ slug }: { slug: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [selectedCutId, setSelectedCutId] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const [isAdding, setIsAdding] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [requiresLogin, setRequiresLogin] = useState(false);

  // Load product details from the existing API.
  useEffect(() => {
    const controller = new AbortController();

    async function loadProduct() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/products/${encodeURIComponent(slug)}`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );

        const data = (await response.json()) as ProductResponse;

        if (!response.ok || !data.success || !data.product) {
          throw new Error(
            data.error || "Unable to load this product."
          );
        }

        setProduct(data.product);
        setSelectedVariantId(data.product.variants[0]?.id ?? "");
        setSelectedCutId("");
        setSelectedImage(0);
        setQuantity(1);
      } catch (err) {
        if (controller.signal.aborted) return;

        console.error("Product details loading failed:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load this product."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadProduct();

    return () => controller.abort();
  }, [slug]);

  const selectedVariant = product?.variants.find(
    (variant) => variant.id === selectedVariantId
  );

  const selectedImageItem = product?.images[selectedImage];

  const isInStock = product?.stockStatus === "IN_STOCK";

  const isChicken =
    product?.category.slug.startsWith("chicken") ||
    product?.category.name.toLowerCase().includes("chicken");

  const fallbackImage =
    product?.name.toLowerCase().includes("prawn")
      ? "/images/storefront/prawns.jpg"
      : "/images/storefront/fish-market.jpg";

  // Add selected variant, quantity and cutting preference to cart.
  async function handleAddToCart() {
    if (!product || !selectedVariant || !isInStock || isAdding) {
      return;
    }

    setIsAdding(true);
    setFeedback("");
    setRequiresLogin(false);

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variantId: selectedVariant.id,
          quantity,
          cutOptionId: selectedCutId || null,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (response.status === 401 || response.status === 403) {
          setRequiresLogin(true);
        }

        setFeedback(
          data.error || "Unable to add this product to your cart."
        );
        return;
      }

      setFeedback("Successfully added to your cart.");
      window.dispatchEvent(new Event("choperz:cart-updated"));
    } catch (err) {
      console.error("Add to cart failed:", err);
      setFeedback("Something went wrong. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen bg-[#F6F3EA] px-5 py-10">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="h-4 w-40 rounded bg-[#DCECE5]" />
          <div className="mt-8 grid gap-8 lg:grid-cols-2">
            <div className="aspect-[4/3] rounded-3xl bg-white" />
            <div className="space-y-5 py-5">
              <div className="h-6 w-32 rounded bg-white" />
              <div className="h-12 w-3/4 rounded bg-white" />
              <div className="h-28 rounded bg-white" />
              <div className="h-14 rounded bg-white" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Error / unavailable state
  if (!product) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#F6F3EA] px-5 py-16">
        <div className="max-w-md rounded-3xl border border-[#E5E4D9] bg-white p-8 text-center">
          <ShoppingBag className="mx-auto size-10 text-[#168477]" />
          <h1 className="mt-5 font-[family-name:var(--font-manrope)] text-2xl font-bold text-[#102D38]">
            Product unavailable
          </h1>
          <p className="mt-3 text-sm leading-6 text-[#64746F]">
            {error || "We couldn't find this product."}
          </p>
          <Link
            href="/products"
            className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-[#168477] px-6 text-sm font-semibold text-white transition hover:bg-[#102D38]"
          >
            Browse all products
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F6F3EA]">

      {/* Breadcrumb */}
      <div className="border-b border-[#E5E4D9] bg-white">
        <div className="mx-auto max-w-[1440px] px-5 py-5 sm:px-8 lg:px-12">
          <nav
            aria-label="Breadcrumb"
            className="flex flex-wrap items-center gap-2 text-xs text-[#87928B]"
          >
            <Link href="/" className="hover:text-[#168477]">
              Home
            </Link>
            <span>/</span>
            <Link href="/products" className="hover:text-[#168477]">
              Shop
            </Link>
            <span>/</span>
            {product.category.parent && (
              <>
                <Link
                  href={`/products?category=${product.category.parent.slug}`}
                  className="hover:text-[#168477]"
                >
                  {product.category.parent.name}
                </Link>
                <span>/</span>
              </>
            )}
            <Link
              href={`/products?category=${product.category.slug}`}
              className="hover:text-[#168477]"
            >
              {product.category.name}
            </Link>
            <span>/</span>
            <span className="font-semibold text-[#168477]">
              {product.name}
            </span>
          </nav>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 lg:px-12 lg:py-14">

        <Link
          href="/products"
          className="mb-7 inline-flex items-center gap-2 text-xs font-semibold text-[#64746F] transition hover:text-[#168477]"
        >
          <ArrowLeft className="size-4" />
          Back to the market
        </Link>

        <div className="grid items-start gap-9 lg:grid-cols-2 lg:gap-16">

          {/* Product gallery */}
          <section>
            <div className="relative isolate overflow-hidden rounded-[26px] border border-[#D8E1DC] bg-[#DCECE5]">
              <div className="aspect-[4/3] sm:aspect-square">
                {selectedImageItem ? (
                  <img
                    src={selectedImageItem.url}
                    alt={selectedImageItem.alt || product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ProductFallback chicken={Boolean(isChicken)} />
                )}
              </div>

              <div className="absolute left-5 top-5">
                {isInStock ? (
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#DCECE5] px-4 py-2 text-[10px] font-bold tracking-wider text-[#102D38]">
                    <span className="size-2 rounded-full bg-[#168477]" />
                    IN STOCK
                  </span>
                ) : (
                  <span className="rounded-full bg-[#102D38]/90 px-4 py-2 text-[10px] font-bold tracking-wider text-white">
                    CURRENTLY UNAVAILABLE
                  </span>
                )}
              </div>
            </div>

            {product.images.length > 1 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {product.images.map((image, index) => (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    aria-label={`View product image ${index + 1}`}
                    aria-pressed={selectedImage === index}
                    className={`size-20 overflow-hidden rounded-xl border-2 transition ${
                      selectedImage === index
                        ? "border-[#168477]"
                        : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img
                      src={image.url}
                      alt={image.alt || product.name}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-3 rounded-xl border border-[#E2E5DB] bg-white p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#DCECE5] text-[#168477]">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#102D38]">
                    Quality focused
                  </p>
                  <p className="mt-1 text-[10px] text-[#87928B]">
                    Carefully selected
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-xl border border-[#E2E5DB] bg-white p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#DCECE5] text-[#168477]">
                  <Truck className="size-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#102D38]">
                    Fresh delivery
                  </p>
                  <p className="mt-1 text-[10px] text-[#87928B]">
                    Serviceability at checkout
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Product information */}
          <section>
            <div className="inline-flex rounded-full bg-[#DCECE5] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.17em] text-[#168477]">
              {product.category.name}
            </div>

            <h1 className="mt-5 font-[family-name:var(--font-manrope)] text-3xl font-extrabold tracking-[-0.055em] text-[#102D38] sm:text-4xl lg:text-5xl">
              {product.name}
            </h1>

            {product.localName && (
              <p className="mt-2 text-sm text-[#64746F]">
                {product.localName}
              </p>
            )}

            {product.scientificName && product.isSourceVerified && (
              <p className="mt-2 text-xs italic text-[#87928B]">
                {product.scientificName}
              </p>
            )}

            <div className="mt-6 flex items-end justify-between gap-4 border-b border-[#D8E1DC] pb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#87928B]">
                  Selected variant price
                </p>

                <p className="mt-2 font-[family-name:var(--font-manrope)] text-3xl font-extrabold text-[#102D38]">
                  {selectedVariant
                    ? formatPrice(selectedVariant.pricePaise)
                    : "Price unavailable"}
                </p>
              </div>

              <span className="pb-1 text-xs text-[#87928B]">
                Inclusive of applicable charges
              </span>
            </div>

            {/* Description */}
            <div className="py-6">
              <h2 className="text-sm font-bold text-[#102D38]">
                About this product
              </h2>

              <p className="mt-3 text-sm leading-7 text-[#64746F]">
                {product.description ||
                  `Explore ${product.name} from the Choperz Fresh collection. Select your preferred weight and cutting option before adding it to your cart.`}
              </p>
            </div>

            {/* Variant selection */}
            <div className="border-t border-[#D8E1DC] py-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#102D38]">
                  Choose your weight
                </h2>
                <span className="text-xs text-[#87928B]">
                  {product.variants.length} options
                </span>
              </div>

              {product.variants.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {product.variants.map((variant) => {
                    const selected = selectedVariantId === variant.id;

                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => {
                          setSelectedVariantId(variant.id);
                          setFeedback("");
                        }}
                        aria-pressed={selected}
                        className={`relative rounded-xl border-2 p-4 text-left transition ${
                          selected
                            ? "border-[#168477] bg-[#EAF4EF]"
                            : "border-[#D8E1DC] bg-white hover:border-[#8FB8A9]"
                        }`}
                      >
                        {selected && (
                          <CheckCircle2 className="absolute right-3 top-3 size-4 text-[#168477]" />
                        )}

                        <span className="block text-sm font-bold text-[#102D38]">
                          {formatWeight(variant.weightGrams)}
                        </span>

                        <span className="mt-2 block text-xs text-[#64746F]">
                          {formatPrice(variant.pricePaise)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl bg-white p-4 text-sm text-[#64746F]">
                  No active weight options are available.
                </p>
              )}
            </div>

            {/* Cutting preferences */}
            {product.cutOptions.length > 0 && (
              <div className="border-t border-[#D8E1DC] py-6">
                <h2 className="text-sm font-bold text-[#102D38]">
                  Cutting preference
                </h2>

                <p className="mt-1 text-xs text-[#87928B]">
                  Choose how you'd like your product prepared.
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedCutId("")}
                    aria-pressed={!selectedCutId}
                    className={`rounded-xl border-2 p-3 text-left text-xs font-semibold transition ${
                      !selectedCutId
                        ? "border-[#168477] bg-[#EAF4EF] text-[#126E63]"
                        : "border-[#D8E1DC] bg-white text-[#64746F]"
                    }`}
                  >
                    No preference
                  </button>

                  {product.cutOptions.map((option) => {
                    const selected = selectedCutId === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedCutId(option.id)}
                        aria-pressed={selected}
                        className={`flex items-center justify-between gap-2 rounded-xl border-2 p-3 text-left text-xs font-semibold transition ${
                          selected
                            ? "border-[#168477] bg-[#EAF4EF] text-[#126E63]"
                            : "border-[#D8E1DC] bg-white text-[#64746F]"
                        }`}
                      >
                        <span>{option.name}</span>
                        {selected && <Check className="size-4 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-3 text-[11px] leading-5 text-[#87928B]">
                  Any applicable cutting charge will be reflected
                  in your cart.
                </p>
              </div>
            )}

            {/* Quantity */}
            <div className="border-t border-[#D8E1DC] py-6">
              <h2 className="mb-3 text-sm font-bold text-[#102D38]">
                Quantity
              </h2>

              <div className="inline-flex h-12 items-center overflow-hidden rounded-xl border border-[#D8E1DC] bg-white">
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className="flex h-full w-12 items-center justify-center text-[#102D38] transition hover:bg-[#F1F5EF] disabled:opacity-35"
                >
                  <Minus className="size-4" />
                </button>

                <span className="min-w-12 text-center text-sm font-bold tabular-nums text-[#102D38]">
                  {quantity}
                </span>

                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.min(99, value + 1))}
                  disabled={quantity >= 99}
                  aria-label="Increase quantity"
                  className="flex h-full w-12 items-center justify-center text-[#102D38] transition hover:bg-[#F1F5EF] disabled:opacity-35"
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </div>

            {/* Add to cart */}
            <div className="border-t border-[#D8E1DC] pt-6">
              <button
                type="button"
                onClick={() => void handleAddToCart()}
                disabled={!isInStock || !selectedVariant || isAdding}
                className="flex min-h-14 w-full items-center justify-center gap-3 rounded-xl bg-[#168477] px-6 text-sm font-bold text-white transition hover:bg-[#102D38] disabled:cursor-not-allowed disabled:bg-[#AABCB6]"
              >
                {isAdding ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    Adding to cart...
                  </>
                ) : !isInStock ? (
                  "Currently unavailable"
                ) : (
                  <>
                    <ShoppingBag className="size-5" />
                    Add to cart
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              {feedback && (
                <p
                  role="status"
                  aria-live="polite"
                  className="mt-4 flex items-center gap-2 text-sm text-[#168477]"
                >
                  {feedback === "Successfully added to your cart." && (
                    <CheckCircle2 className="size-4 shrink-0" />
                  )}
                  {feedback}
                </p>
              )}

              {requiresLogin && (
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(`/products/${product.slug}`)}`}
                  className="mt-3 inline-flex text-sm font-semibold text-[#168477] underline underline-offset-4"
                >
                  Sign in to continue
                </Link>
              )}

              <Link
                href="/cart"
                className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#D8E1DC] text-sm font-semibold text-[#102D38] transition hover:border-[#168477] hover:text-[#168477]"
              >
                View your cart
                <ArrowRight className="size-4" />
              </Link>
            </div>

            {/* Additional information */}
            {(product.sourceInfo || product.storageInstructions) && (
              <div className="mt-8 space-y-4 rounded-2xl border border-[#E2E5DB] bg-white p-5">
                {product.sourceInfo && (
                  <div>
                    <h3 className="text-xs font-bold text-[#102D38]">
                      Sourcing information
                    </h3>
                    <p className="mt-2 text-xs leading-6 text-[#64746F]">
                      {product.sourceInfo}
                    </p>
                  </div>
                )}

                {product.storageInstructions && (
                  <div>
                    <h3 className="text-xs font-bold text-[#102D38]">
                      Storage instructions
                    </h3>
                    <p className="mt-2 text-xs leading-6 text-[#64746F]">
                      {product.storageInstructions}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Verified nutrition */}
            {product.nutrition && (
              <div className="mt-5 rounded-2xl border border-[#E2E5DB] bg-white p-5">
                <h3 className="text-sm font-bold text-[#102D38]">
                  Nutrition information
                </h3>

                <p className="mt-1 text-[10px] text-[#87928B]">
                  Verified product information
                </p>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ["Energy", product.nutrition.energyKcal, "kcal"],
                    ["Protein", product.nutrition.proteinG, "g"],
                    ["Fat", product.nutrition.fatG, "g"],
                    ["Carbs", product.nutrition.carbsG, "g"],
                  ].map(([label, value, unit]) => (
                    <div
                      key={String(label)}
                      className="rounded-lg bg-[#F6F3EA] p-3"
                    >
                      <p className="text-[10px] text-[#87928B]">
                        {label}
                      </p>
                      <p className="mt-1 text-sm font-bold text-[#102D38]">
                        {value === null
                          ? "—"
                          : `${value} ${unit}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Return to catalogue */}
        <div className="mt-16 border-t border-[#D8E1DC] pt-8">
          <Link
            href="/products"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#168477] transition hover:text-[#102D38]"
          >
            <ArrowLeft className="size-4" />
            Continue exploring the Choperz market
          </Link>
        </div>
      </div>
    </main>
  );
}
