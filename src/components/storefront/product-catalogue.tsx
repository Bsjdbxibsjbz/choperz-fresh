
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Drumstick,
  Fish,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  X,
} from "lucide-react";

type ProductVariant = {
  id: string;
  sku: string;
  label: string;
  weightGrams: number;
  pricePaise: number | null;
};

type ProductCutOption = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  slug: string;
  name: string;
  localName: string | null;
  englishName: string | null;
  description: string | null;
  storageInstructions: string | null;
  stockStatus: "IN_STOCK" | "OUT_OF_STOCK";
  category: {
    slug: string;
    name: string;
  };
  variants: ProductVariant[];
  images: {
    id: string;
    url: string;
    alt: string;
  }[];
  cutOptions: ProductCutOption[];
};

type Category = {
  id: string;
  slug: string;
  name: string;
  productCount: number;
  children: {
    id: string;
    slug: string;
    name: string;
    productCount: number;
  }[];
};

type ProductsResponse = {
  success: boolean;
  error?: string;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  products: Product[];
};

type CategoriesResponse = {
  success: boolean;
  error?: string;
  categories: Category[];
};

type SortOption =
  | "recommended"
  | "price-low"
  | "price-high"
  | "name";

const API_LIMIT = 50;
const DISPLAY_LIMIT = 12;

const formatPrice = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / 100);

function isChicken(product: Product) {
  return (
    product.category.slug.startsWith("chicken") ||
    product.category.name.toLowerCase().includes("chicken")
  );
}

function getStartingPrice(product: Product) {
  const prices = product.variants
    .map((variant) => variant.pricePaise)
    .filter((price): price is number => price !== null);

  return prices.length ? Math.min(...prices) : null;
}

/* -------------------------------------------------------------------------- */
/* Product card                                                                */
/* -------------------------------------------------------------------------- */

function CatalogueProductCard({
  product,
}: {
  product: Product;
}) {
  const [variantId, setVariantId] = useState(
    product.variants[0]?.id ?? ""
  );
  const [cutOptionId, setCutOptionId] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  const selectedVariant = product.variants.find(
    (variant) => variant.id === variantId
  );

  const inStock = product.stockStatus === "IN_STOCK";
  const chicken = isChicken(product);

  const imageUrl = product.images[0]?.url || (
    chicken
      ? null
      : product.name.toLowerCase().includes("prawn")
        ? "/images/storefront/prawns.jpg"
        : "/images/storefront/fish-market.jpg"
  );

  const startingPrice = getStartingPrice(product);

  useEffect(() => {
    if (!product.variants.some((variant) => variant.id === variantId)) {
      setVariantId(product.variants[0]?.id ?? "");
    }
  }, [product.variants, variantId]);

  async function addToCart() {
    if (!selectedVariant || !inStock || isAdding) return;

    setIsAdding(true);
    setFeedback("");
    setNeedsLogin(false);

    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        credentials: "include",
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
        if (response.status === 401 || response.status === 403) {
          setNeedsLogin(true);
        }

        setFeedback(
          data.error || "Unable to add this product to your cart."
        );
        return;
      }

      setFeedback("Added to your cart!");
      window.dispatchEvent(new Event("choperz:cart-updated"));
    } catch (error) {
      console.error("Add to cart failed:", error);
      setFeedback("Something went wrong. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden rounded-[22px] border border-[#D8E1DC] bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#102D38]/8">

      {/* Product image */}
      <Link
        href={`/products/${product.slug}`}
        className="relative isolate block aspect-[4/3] overflow-hidden bg-[#DCECE5]"
        aria-label={`View ${product.name}`}
      >
        {imageUrl ? (
          <div
            role="img"
            aria-label={
              product.images[0]?.alt ||
              `${product.name} photograph`
            }
            className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
            style={{
              backgroundImage: `linear-gradient(to top, rgba(16,45,56,0.25), transparent 55%), url("${imageUrl}")`,
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1C414C] via-[#102D38] to-[#168477]/50">
            <div className="flex size-24 items-center justify-center rounded-full border border-[#8FB8A9]/20 bg-[#DCECE5] text-[#102D38] shadow-xl transition-transform duration-500 group-hover:scale-110">
              {chicken ? (
                <Drumstick className="size-12" strokeWidth={1.2} />
              ) : (
                <Fish className="size-12" strokeWidth={1.2} />
              )}
            </div>
            <span className="mt-3 text-[9px] font-semibold uppercase tracking-[0.22em] text-[#DCECE5]/80">
              Choperz Fresh
            </span>
          </div>
        )}

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

        <span className="absolute bottom-4 right-4 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-semibold text-[#102D38] backdrop-blur-md">
          {product.category.name}
        </span>
      </Link>

      {/* Product details */}
      <div className="flex flex-1 flex-col p-5">
        <div>
          <Link
            href={`/products/${product.slug}`}
            className="font-[family-name:var(--font-manrope)] text-lg font-bold tracking-tight text-[#102D38] transition-colors hover:text-[#168477]"
          >
            {product.name}
          </Link>

          {product.localName && (
            <p className="mt-1 text-xs text-[#87928B]">
              {product.localName}
            </p>
          )}

          {product.description && (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#64746F]">
              {product.description}
            </p>
          )}
        </div>

        <div className="mt-5 space-y-3">
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
              disabled={product.variants.length === 0}
              className="h-10 w-full rounded-lg border border-[#D8E1DC] bg-[#F6F3EA] px-3 text-xs font-medium text-[#102D38] outline-none focus:border-[#168477] disabled:opacity-50"
            >
              {product.variants.length === 0 && (
                <option value="">Unavailable</option>
              )}

              {product.variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.label}
                  {variant.pricePaise !== null
                    ? ` · ${formatPrice(variant.pricePaise)}`
                    : ""}
                </option>
              ))}
            </select>
          </div>

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

        {/* Price and add button */}
        <div className="mt-auto border-t border-[#E8EDE9] pt-4">
          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-[#8A9998]">
                {product.variants.length > 1
                  ? "Selected price"
                  : "Price"}
              </p>

              <p className="mt-1 font-[family-name:var(--font-manrope)] text-xl font-extrabold text-[#102D38]">
                {selectedVariant?.pricePaise != null
                  ? formatPrice(selectedVariant.pricePaise)
                  : startingPrice !== null
                    ? `From ${formatPrice(startingPrice)}`
                    : "Price unavailable"}
              </p>
            </div>

            <button
              type="button"
              disabled={!inStock || !selectedVariant || isAdding}
              onClick={() => void addToCart()}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#168477] px-4 text-xs font-bold text-white transition-all hover:bg-[#102D38] disabled:cursor-not-allowed disabled:bg-[#D8E1DC] disabled:text-[#60717A]"
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

          {needsLogin && (
            <Link
              href={`/login?callbackUrl=${encodeURIComponent("/products")}`}
              className="mt-2 inline-block text-xs font-semibold text-[#168477] underline underline-offset-4"
            >
              Sign in to continue
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Main catalogue                                                              */
/* -------------------------------------------------------------------------- */

export function ProductCatalogue({
  initialQuery = "",
  initialCategory = "",
}: {
  initialQuery?: string;
  initialCategory?: string;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [searchInput, setSearchInput] = useState(initialQuery);
  const [activeSearch, setActiveSearch] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] =
    useState(initialCategory);

  const [sortBy, setSortBy] =
    useState<SortOption>("recommended");

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [error, setError] = useState("");
  const [categoryError, setCategoryError] = useState("");

  const [totalCount, setTotalCount] = useState(0);
  const [apiPage, setApiPage] = useState(1);
  const [apiTotalPages, setApiTotalPages] = useState(1);
  const [displayPage, setDisplayPage] = useState(1);

  // Load active category groups.
  useEffect(() => {
    const controller = new AbortController();

    async function loadCategories() {
      try {
        const response = await fetch("/api/categories", {
          signal: controller.signal,
          cache: "no-store",
        });

        const data = (await response.json()) as CategoriesResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Unable to load product categories."
          );
        }

        setCategories(data.categories);
      } catch (err) {
        if (controller.signal.aborted) return;

        console.error("Category loading failed:", err);
        setCategoryError("Some category filters could not be loaded.");
      }
    }

    void loadCategories();

    return () => controller.abort();
  }, []);

  // Debounce catalogue search.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setActiveSearch(searchInput.trim());
      setDisplayPage(1);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  // Fetch the first API page whenever filters change.
  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setLoading(true);
      setError("");
      setDisplayPage(1);

      try {
        const params = new URLSearchParams({
          page: "1",
          limit: String(API_LIMIT),
        });

        if (activeSearch) {
          params.set("q", activeSearch);
        }

        if (selectedCategory) {
          params.set("category", selectedCategory);
        }

        const response = await fetch(
          `/api/products?${params.toString()}`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );

        const data = (await response.json()) as ProductsResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Unable to load the product catalogue."
          );
        }

        setProducts(data.products);
        setTotalCount(data.pagination.total);
        setApiPage(data.pagination.page);
        setApiTotalPages(data.pagination.totalPages);
      } catch (err) {
        if (controller.signal.aborted) return;

        console.error("Product catalogue loading failed:", err);

        setProducts([]);
        setTotalCount(0);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load products."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadProducts();

    return () => controller.abort();
  }, [activeSearch, selectedCategory]);

  // Fetch additional API pages when the catalogue exceeds 50 products.
  const loadMore = useCallback(async () => {
    if (loadingMore || apiPage >= apiTotalPages) return;

    const nextPage = apiPage + 1;
    setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(API_LIMIT),
      });

      if (activeSearch) params.set("q", activeSearch);
      if (selectedCategory) params.set("category", selectedCategory);

      const response = await fetch(
        `/api/products?${params.toString()}`,
        { cache: "no-store" }
      );

      const data = (await response.json()) as ProductsResponse;

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load more products.");
      }

      setProducts((current) => {
        const existingIds = new Set(current.map((product) => product.id));
        return [
          ...current,
          ...data.products.filter((product) => !existingIds.has(product.id)),
        ];
      });

      setApiPage(data.pagination.page);
      setTotalCount(data.pagination.total);
      setApiTotalPages(data.pagination.totalPages);
    } catch (err) {
      console.error("Load more products failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load more products."
      );
    } finally {
      setLoadingMore(false);
    }
  }, [
    activeSearch,
    selectedCategory,
    apiPage,
    apiTotalPages,
    loadingMore,
  ]);

  // Sort fetched products.
  const sortedProducts = useMemo(() => {
    const result = [...products];

    result.sort((a, b) => {
      if (sortBy === "recommended") {
        const stockDifference =
          Number(b.stockStatus === "IN_STOCK") -
          Number(a.stockStatus === "IN_STOCK");

        if (stockDifference !== 0) return stockDifference;

        return a.name.localeCompare(b.name);
      }

      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }

      const aPrice = getStartingPrice(a) ?? Number.MAX_SAFE_INTEGER;
      const bPrice = getStartingPrice(b) ?? Number.MAX_SAFE_INTEGER;

      return sortBy === "price-low"
        ? aPrice - bPrice
        : bPrice - aPrice;
    });

    return result;
  }, [products, sortBy]);

  const pageCount = Math.max(
    1,
    Math.ceil(sortedProducts.length / DISPLAY_LIMIT)
  );

  const visibleProducts = sortedProducts.slice(
    (displayPage - 1) * DISPLAY_LIMIT,
    displayPage * DISPLAY_LIMIT
  );

  const categoryName =
    selectedCategory === ""
      ? "All products"
      : categories
          .flatMap((category) => [
            category,
            ...category.children,
          ])
          .find((category) => category.slug === selectedCategory)?.name ||
        "Selected collection";

  function selectCategory(slug: string) {
    setSelectedCategory(slug);
    setDisplayPage(1);
    setMobileFiltersOpen(false);
  }

  function clearFilters() {
    setSearchInput("");
    setActiveSearch("");
    setSelectedCategory("");
    setSortBy("recommended");
    setDisplayPage(1);
    setMobileFiltersOpen(false);
  }

  const allCategoryButtons = categories.flatMap((category) => [
    {
      slug: category.slug,
      name: category.name,
      productCount: category.productCount,
      isParent: true,
    },
    ...category.children.map((child) => ({
      slug: child.slug,
      name: child.name,
      productCount: child.productCount,
      isParent: false,
    })),
  ]);

  return (
    <main className="min-h-screen bg-[#F6F3EA]">

      {/* Catalogue introduction */}
      <section className="border-b border-[#E5E4D9] bg-white">
        <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#168477]">
            THE CHOPERZ MARKET
          </p>

          <div className="mt-4 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <h1 className="font-[family-name:var(--font-manrope)] text-3xl font-extrabold tracking-[-0.055em] text-[#102D38] sm:text-4xl lg:text-5xl">
                Discover something
                <span className="block text-[#168477]">
                  fresh today.
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-[#60717A] sm:text-base">
                Explore carefully selected seafood and chicken
                favourites for your next coastal meal.
              </p>
            </div>

            {!loading && (
              <p className="text-sm font-medium text-[#64746F]">
                {totalCount} products in our collection
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-12 lg:py-10">

        {/* Search and sort */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex min-h-12 flex-1 items-center gap-3 rounded-xl border border-[#D8E1DC] bg-white px-4 transition focus-within:border-[#168477] focus-within:ring-2 focus-within:ring-[#168477]/10">
            <Search className="size-5 shrink-0 text-[#87928B]" />

            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search fish, prawns, chicken..."
              aria-label="Search products"
              className="h-12 min-w-0 flex-1 bg-transparent text-sm text-[#102D38] outline-none placeholder:text-[#A0AAA4]"
            />

            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
                className="text-[#87928B] transition hover:text-[#102D38]"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileFiltersOpen((open) => !open)}
              aria-expanded={mobileFiltersOpen}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#D8E1DC] bg-white px-4 text-xs font-semibold text-[#102D38] lg:hidden"
            >
              <SlidersHorizontal className="size-4" />
              Categories
            </button>

            <div className="flex h-12 flex-1 items-center gap-2 rounded-xl border border-[#D8E1DC] bg-white px-3 sm:flex-none">
              <span className="hidden text-[10px] font-bold uppercase tracking-wider text-[#87928B] sm:inline">
                Sort
              </span>

              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(event.target.value as SortOption)
                }
                aria-label="Sort products"
                className="h-full min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#102D38] outline-none sm:min-w-40"
              >
                <option value="recommended">Recommended</option>
                <option value="price-low">Price: Low to high</option>
                <option value="price-high">Price: High to low</option>
                <option value="name">Name: A to Z</option>
              </select>
            </div>
          </div>
        </div>

        {/* Mobile category filters */}
        {mobileFiltersOpen && (
          <div className="mt-4 rounded-2xl border border-[#D8E1DC] bg-white p-4 lg:hidden">
            <button
              type="button"
              onClick={() => selectCategory("")}
              className={`mb-2 flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm font-semibold ${
                selectedCategory === ""
                  ? "bg-[#DCECE5] text-[#126E63]"
                  : "text-[#50636A] hover:bg-[#F6F3EA]"
              }`}
            >
              All products
              <span className="text-xs">{totalCount}</span>
            </button>

            {allCategoryButtons.map((category) => (
              <button
                key={category.slug}
                type="button"
                onClick={() => selectCategory(category.slug)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm ${
                  category.isParent
                    ? "font-semibold"
                    : "pl-7 text-[13px]"
                } ${
                  selectedCategory === category.slug
                    ? "bg-[#DCECE5] text-[#126E63]"
                    : "text-[#50636A] hover:bg-[#F6F3EA]"
                }`}
              >
                {category.name}
                <span className="text-xs text-[#87928B]">
                  {category.productCount}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-8 flex items-center gap-2 text-xs text-[#87928B]">
          <Link href="/" className="transition hover:text-[#168477]">
            Home
          </Link>
          <span>/</span>
          <span className="font-semibold text-[#168477]">
            {categoryName}
          </span>
        </div>

        {/* Main catalogue layout */}
        <div className="mt-6 grid items-start gap-8 lg:grid-cols-[230px_minmax(0,1fr)]">

          {/* Desktop category sidebar */}
          <aside className="sticky top-28 hidden rounded-2xl border border-[#E2E5DB] bg-white p-5 lg:block">
            <h2 className="font-[family-name:var(--font-manrope)] text-base font-bold text-[#102D38]">
              Shop by category
            </h2>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() => selectCategory("")}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${
                  selectedCategory === ""
                    ? "bg-[#DCECE5] text-[#126E63]"
                    : "text-[#50636A] hover:bg-[#F6F3EA]"
                }`}
              >
                All products
                <span className="text-xs">{totalCount}</span>
              </button>

              {categories.map((category) => (
                <div key={category.id} className="pt-2">
                  <button
                    type="button"
                    onClick={() => selectCategory(category.slug)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-bold transition ${
                      selectedCategory === category.slug
                        ? "bg-[#DCECE5] text-[#126E63]"
                        : "text-[#102D38] hover:bg-[#F6F3EA]"
                    }`}
                  >
                    {category.name}
                    <span className="text-xs font-medium text-[#87928B]">
                      {category.productCount}
                    </span>
                  </button>

                  {category.children.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => selectCategory(child.slug)}
                      className={`mt-1 flex w-full items-center justify-between rounded-lg py-2.5 pl-6 pr-3 text-left text-xs transition ${
                        selectedCategory === child.slug
                          ? "bg-[#DCECE5] font-semibold text-[#126E63]"
                          : "text-[#64746F] hover:bg-[#F6F3EA] hover:text-[#168477]"
                      }`}
                    >
                      {child.name}
                      <span className="text-[10px] text-[#A0AAA4]">
                        {child.productCount}
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {categoryError && (
              <p className="mt-3 text-[10px] text-[#A46E45]">
                {categoryError}
              </p>
            )}

            <div className="mt-7 rounded-xl bg-[#F6F3EA] p-4">
              <div className="flex items-center gap-2 text-[#168477]">
                <Fish className="size-4" />
                <span className="text-xs font-bold">
                  The Choperz market
                </span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-[#64746F]">
                Browse the collection and choose the right cut and
                weight for your kitchen.
              </p>
            </div>
          </aside>

          {/* Product results */}
          <section aria-label="Product results">

            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-[family-name:var(--font-manrope)] text-xl font-bold text-[#102D38]">
                  {activeSearch
                    ? `Results for "${activeSearch}"`
                    : categoryName}
                </h2>

                {!loading && (
                  <p className="mt-1 text-xs text-[#87928B]">
                    Showing{" "}
                    {Math.min(
                      (displayPage - 1) * DISPLAY_LIMIT + 1,
                      sortedProducts.length
                    )}
                    {"–"}
                    {Math.min(
                      displayPage * DISPLAY_LIMIT,
                      sortedProducts.length
                    )}{" "}
                    of {totalCount} products
                  </p>
                )}
              </div>

              {(selectedCategory || activeSearch || sortBy !== "recommended") && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-semibold text-[#168477] underline underline-offset-4 transition hover:text-[#102D38]"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Loading */}
            {loading && (
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <div
                    key={item}
                    className="h-[430px] animate-pulse rounded-[22px] border border-[#E5E4D9] bg-white"
                  />
                ))}
              </div>
            )}

            {/* Error */}
            {!loading && error && (
              <div className="rounded-2xl border border-[#D8E1DC] bg-white p-10 text-center">
                <p className="font-semibold text-[#102D38]">
                  We couldn't load the catalogue.
                </p>
                <p className="mt-2 text-sm text-[#64746F]">{error}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-5 rounded-full bg-[#102D38] px-6 py-3 text-xs font-bold text-white transition hover:bg-[#168477]"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Product grid */}
            {!loading && !error && visibleProducts.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">
                  {visibleProducts.map((product) => (
                    <CatalogueProductCard
                      key={product.id}
                      product={product}
                    />
                  ))}
                </div>

                {/* Local pagination */}
                {pageCount > 1 && (
                  <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={displayPage === 1}
                      onClick={() => {
                        setDisplayPage((page) => Math.max(1, page - 1));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="h-10 rounded-full border border-[#D8E1DC] bg-white px-4 text-xs font-semibold text-[#102D38] transition hover:border-[#168477] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>

                    {Array.from({ length: pageCount }, (_, index) => index + 1).map(
                      (page) => (
                        <button
                          key={page}
                          type="button"
                          aria-current={displayPage === page ? "page" : undefined}
                          onClick={() => {
                            setDisplayPage(page);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className={`size-10 rounded-full text-xs font-bold transition ${
                            displayPage === page
                              ? "bg-[#102D38] text-white"
                              : "border border-[#D8E1DC] bg-white text-[#50636A] hover:border-[#168477]"
                          }`}
                        >
                          {page}
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      disabled={displayPage === pageCount}
                      onClick={() => {
                        setDisplayPage((page) =>
                          Math.min(pageCount, page + 1)
                        );
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="h-10 rounded-full border border-[#D8E1DC] bg-white px-4 text-xs font-semibold text-[#102D38] transition hover:border-[#168477] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                )}

                {/* Fetch additional API pages if needed */}
                {products.length < totalCount && apiPage < apiTotalPages && (
                  <div className="mt-8 text-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={() => void loadMore()}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#168477] bg-white px-6 text-xs font-bold text-[#168477] transition hover:bg-[#DCECE5] disabled:opacity-50"
                    >
                      {loadingMore ? "Loading..." : "Load more products"}
                      <ArrowRight className="size-4" />
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Empty state */}
            {!loading && !error && visibleProducts.length === 0 && (
              <div className="rounded-2xl border border-[#E5E4D9] bg-white px-6 py-16 text-center">
                <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#DCECE5] text-[#168477]">
                  <ShoppingBag className="size-7" />
                </div>

                <h3 className="mt-5 font-[family-name:var(--font-manrope)] text-xl font-bold text-[#102D38]">
                  Nothing here just yet.
                </h3>

                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#64746F]">
                  We couldn't find products matching those filters.
                  Try another search or explore the full collection.
                </p>

                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[#168477] px-6 text-xs font-bold text-white transition hover:bg-[#102D38]"
                >
                  Explore all products
                  <ArrowRight className="size-4" />
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
