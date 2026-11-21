"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Minus,
  Package,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";

type CartImage = {
  url: string;
  alt: string;
};

type CartItem = {
  id: string;
  quantity: number;
  available: boolean;
  unavailableReason: string | null;
  variant: {
    id: string;
    label: string;
    weightGrams: number;
    pricePaise: number;
    product: {
      id: string;
      slug: string;
      name: string;
      images: CartImage[];
    };
  };
  cutOption: {
    id: string;
    name: string;
    extraPricePaise: number;
  } | null;
  unitPricePaise: number;
  lineTotalPaise: number;
};

type CartData = {
  id: string | null;
  items: CartItem[];
  subtotalPaise: number;
  totalQuantity: number;
  unavailableItemsCount: number;
};

type CartApiResponse = {
  success?: boolean;
  error?: string;
  cart?: CartData;
};

const formatPrice = (paise: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);

async function readResponse(
  response: Response
): Promise<CartApiResponse> {
  return response.json().catch(() => ({
    success: false,
    error: "The server returned an invalid response.",
  }));
}

export function CartPage() {
  const [cart, setCart] = useState<CartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [mutatingItemId, setMutatingItemId] = useState<string | null>(
    null
  );

  // Fetch the customer's saved cart.
  const loadCart = useCallback(async (showLoading = true) => {
    if (showLoading) {
      setLoading(true);
    }

    setError(null);

    try {
      const response = await fetch("/api/cart", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const payload = await readResponse(response);

      if (response.status === 401 || response.status === 403) {
        setRequiresLogin(true);
        setAuthMessage(
          payload.error || "Please sign in to view your cart."
        );
        setCart(null);
        return;
      }

      if (!response.ok || !payload.success || !payload.cart) {
        throw new Error(
          payload.error || "Unable to load your cart."
        );
      }

      setRequiresLogin(false);
      setAuthMessage("");
      setCart(payload.cart);
    } catch (err) {
      console.error("Cart loading failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading your cart."
      );
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadCart();

    // Refresh cart if another storefront component adds an item.
    const handleCartUpdate = () => {
      void loadCart(false);
    };

    window.addEventListener(
      "choperz:cart-updated",
      handleCartUpdate
    );

    return () => {
      window.removeEventListener(
        "choperz:cart-updated",
        handleCartUpdate
      );
    };
  }, [loadCart]);

  // Update the quantity of a cart item.
  async function updateQuantity(
    itemId: string,
    quantity: number
  ) {
    if (quantity < 1 || quantity > 99 || mutatingItemId) return;

    setMutatingItemId(itemId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/cart", {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId,
          quantity,
        }),
      });

      const payload = await readResponse(response);

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error || "Unable to update the quantity."
        );
      }

      await loadCart(false);
      setNotice("Your cart has been updated.");
    } catch (err) {
      console.error("Cart quantity update failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update this item."
      );
    } finally {
      setMutatingItemId(null);
    }
  }

  // Remove an item from the cart.
  async function removeItem(itemId: string) {
    if (mutatingItemId) return;

    setMutatingItemId(itemId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/cart?itemId=${encodeURIComponent(itemId)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const payload = await readResponse(response);

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error || "Unable to remove this item."
        );
      }

      await loadCart(false);
      setNotice("Item removed from your cart.");
    } catch (err) {
      console.error("Cart item removal failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to remove this item."
      );
    } finally {
      setMutatingItemId(null);
    }
  }

  const items = cart?.items ?? [];
  const hasUnavailableItems =
    (cart?.unavailableItemsCount ?? 0) > 0;

  return (
    <main className="min-h-screen bg-[#F6F3EA] pb-20">
      {/* Page heading */}
      <section className="border-b border-[#E5E4D9] bg-white">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
          <Link
            href="/"
            className="mb-7 inline-flex items-center gap-2 text-sm font-medium text-[#64746F] transition hover:text-[#168477]"
          >
            <ArrowLeft className="h-4 w-4" />
            Continue shopping
          </Link>

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[#168477]">
                Your selection
              </p>

              <h1 className="font-[var(--font-manrope)] text-3xl font-bold tracking-tight text-[#102D38] sm:text-4xl lg:text-5xl">
                Your cart.
                <span className="text-[#168477]">
                  {" "}Fresh choices.
                </span>
              </h1>

              <p className="mt-3 max-w-xl text-sm leading-7 text-[#64746F] sm:text-base">
                Your favourite catch, carefully selected and
                ready for the next step.
              </p>
            </div>

            {!loading && cart && (
              <div className="flex items-center gap-2 text-sm font-medium text-[#64746F]">
                <ShoppingBag className="h-4 w-4 text-[#168477]" />
                {cart.totalQuantity}{" "}
                {cart.totalQuantity === 1 ? "item" : "items"} in your cart
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">

        {/* Loading state */}
        {loading && (
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="h-40 animate-pulse rounded-2xl border border-[#E5E4D9] bg-white"
                />
              ))}
            </div>

            <div className="h-72 animate-pulse rounded-2xl border border-[#E5E4D9] bg-white" />
          </div>
        )}

        {/* Login required */}
        {!loading && requiresLogin && (
          <section className="mx-auto max-w-xl rounded-3xl border border-[#E2E5DB] bg-white px-6 py-14 text-center shadow-sm sm:px-12">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#DCECE5] text-[#168477]">
              <ShieldCheck className="h-8 w-8" />
            </div>

            <h2 className="text-2xl font-bold text-[#102D38]">
              Sign in to view your cart
            </h2>

            <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-[#64746F]">
              {authMessage}
            </p>

            <Link
              href="/login?callbackUrl=%2Fcart"
              className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#168477] px-7 text-sm font-semibold text-white transition hover:bg-[#126E63]"
            >
              Sign in with phone
              <ArrowRight className="h-4 w-4" />
            </Link>
          </section>
        )}

        {/* Error state */}
        {!loading && !requiresLogin && error && !cart && (
          <section className="mx-auto max-w-xl rounded-3xl border border-red-100 bg-white px-6 py-14 text-center">
            <h2 className="text-xl font-bold text-[#102D38]">
              We couldn&apos;t load your cart
            </h2>

            <p className="mt-3 text-sm leading-6 text-[#64746F]">
              {error}
            </p>

            <button
              type="button"
              onClick={() => void loadCart()}
              className="mt-7 rounded-xl bg-[#168477] px-7 py-3 text-sm font-semibold text-white transition hover:bg-[#126E63]"
            >
              Try again
            </button>
          </section>
        )}

        {/* Empty cart */}
        {!loading &&
          !requiresLogin &&
          !error &&
          cart &&
          items.length === 0 && (
            <section className="mx-auto max-w-xl rounded-3xl border border-[#E2E5DB] bg-white px-6 py-14 text-center shadow-sm sm:px-12">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#DCECE5] text-[#168477]">
                <ShoppingBag className="h-9 w-9" />
              </div>

              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#168477]">
                Nothing in the basket yet
              </p>

              <h2 className="text-2xl font-bold text-[#102D38]">
                Your cart is waiting for something fresh.
              </h2>

              <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-[#64746F]">
                Explore our selection and find something delicious
                for your next meal.
              </p>

              <Link
                href="/"
                className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#168477] px-7 text-sm font-semibold text-white transition hover:bg-[#126E63]"
              >
                Explore the collection
                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>
          )}

        {/* Populated cart */}
        {!loading &&
          !requiresLogin &&
          cart &&
          items.length > 0 && (
            <>
              {/* Feedback */}
              {(error || notice) && (
                <div
                  role="status"
                  aria-live="polite"
                  className={`mb-6 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
                    error
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-[#C9E1D7] bg-[#EAF4EF] text-[#126E63]"
                  }`}
                >
                  {error ? (
                    <span className="font-semibold">Attention:</span>
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{error || notice}</span>
                </div>
              )}

              {hasUnavailableItems && (
                <div className="mb-6 rounded-xl border border-[#E9D9B9] bg-[#FBF4E6] px-4 py-4 text-sm leading-6 text-[#7A5B28]">
                  Some items in your cart are no longer available.
                  Remove or review them before proceeding to checkout.
                </div>
              )}

              <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">

                {/* Cart items */}
                <section>
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-[#102D38]">
                      Cart items
                    </h2>

                    <span className="text-xs font-medium text-[#87928B]">
                      Prices in INR
                    </span>
                  </div>

                  <div className="space-y-4">
                    {items.map((item) => {
                      const image = item.variant.product.images?.[0];
                      const itemBusy = mutatingItemId === item.id;

                      return (
                        <article
                          key={item.id}
                          className={`overflow-hidden rounded-2xl border bg-white shadow-[0_3px_18px_rgba(16,45,56,0.035)] ${
                            item.available
                              ? "border-[#E5E4D9]"
                              : "border-[#E9D9B9]"
                          }`}
                        >
                          <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-center sm:p-5">

                            {/* Product image */}
                            <Link
                              href={`/products/${item.variant.product.slug}`}
                              className="relative flex h-28 w-full shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#DCECE5] sm:h-28 sm:w-28"
                            >
                              {image?.url ? (
                                <img
                                  src={image.url}
                                  alt={
                                    image.alt ||
                                    item.variant.product.name
                                  }
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package className="h-10 w-10 text-[#168477]" />
                              )}
                            </Link>

                            {/* Product details */}
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <Link
                                    href={`/products/${item.variant.product.slug}`}
                                    className="text-base font-bold text-[#102D38] transition hover:text-[#168477] sm:text-lg"
                                  >
                                    {item.variant.product.name}
                                  </Link>

                                  <p className="mt-1 text-sm text-[#64746F]">
                                    {item.variant.label}
                                    {" · "}
                                    {item.variant.weightGrams >= 1000
                                      ? `${item.variant.weightGrams / 1000} kg`
                                      : `${item.variant.weightGrams} g`}
                                  </p>

                                  {item.cutOption && (
                                    <p className="mt-2 text-xs font-medium text-[#168477]">
                                      Cut preference: {item.cutOption.name}
                                    </p>
                                  )}

                                  {item.cutOption &&
                                    item.cutOption.extraPricePaise > 0 && (
                                      <p className="mt-1 text-xs text-[#87928B]">
                                        Includes{" "}
                                        {formatPrice(
                                          item.cutOption.extraPricePaise
                                        )}{" "}
                                        cutting charge per item
                                      </p>
                                    )}
                                </div>

                                <div className="text-right">
                                  <p className="text-base font-bold tabular-nums text-[#102D38]">
                                    {formatPrice(item.lineTotalPaise)}
                                  </p>

                                  <p className="mt-1 text-xs text-[#87928B]">
                                    {formatPrice(item.unitPricePaise)} each
                                  </p>
                                </div>
                              </div>

                              {/* Availability */}
                              {!item.available && (
                                <p className="mt-3 rounded-lg bg-[#FBF4E6] px-3 py-2 text-xs leading-5 text-[#89672F]">
                                  {item.unavailableReason ||
                                    "This item is currently unavailable."}
                                </p>
                              )}

                              {/* Quantity and remove controls */}
                              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                                <div className="inline-flex h-10 items-center overflow-hidden rounded-lg border border-[#DCE3DA] bg-white">
                                  <button
                                    type="button"
                                    aria-label="Decrease quantity"
                                    disabled={
                                      !item.available ||
                                      item.quantity <= 1 ||
                                      !!mutatingItemId
                                    }
                                    onClick={() =>
                                      void updateQuantity(
                                        item.id,
                                        item.quantity - 1
                                      )
                                    }
                                    className="flex h-full w-10 items-center justify-center text-[#102D38] transition hover:bg-[#F1F5EF] disabled:cursor-not-allowed disabled:opacity-35"
                                  >
                                    <Minus className="h-3.5 w-3.5" />
                                  </button>

                                  <span className="min-w-9 text-center text-sm font-semibold tabular-nums text-[#102D38]">
                                    {item.quantity}
                                  </span>

                                  <button
                                    type="button"
                                    aria-label="Increase quantity"
                                    disabled={
                                      !item.available ||
                                      item.quantity >= 99 ||
                                      !!mutatingItemId
                                    }
                                    onClick={() =>
                                      void updateQuantity(
                                        item.id,
                                        item.quantity + 1
                                      )
                                    }
                                    className="flex h-full w-10 items-center justify-center text-[#102D38] transition hover:bg-[#F1F5EF] disabled:cursor-not-allowed disabled:opacity-35"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  disabled={!!mutatingItemId}
                                  onClick={() => void removeItem(item.id)}
                                  className="inline-flex items-center gap-2 text-xs font-semibold text-[#9A6251] transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                  {itemBusy ? "Updating..." : "Remove"}
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  {/* Trust details */}
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-xl border border-[#E5E4D9] bg-white p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#DCECE5] text-[#168477]">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#102D38]">
                          Carefully selected
                        </p>
                        <p className="mt-1 text-xs text-[#87928B]">
                          Quality matters to us.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 rounded-xl border border-[#E5E4D9] bg-white p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#DCECE5] text-[#168477]">
                        <Truck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#102D38]">
                          Delivery availability
                        </p>
                        <p className="mt-1 text-xs text-[#87928B]">
                          Confirmed at checkout.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Order summary */}
                <aside className="lg:sticky lg:top-28">
                  <div className="overflow-hidden rounded-2xl border border-[#E5E4D9] bg-white shadow-[0_5px_24px_rgba(16,45,56,0.045)]">
                    <div className="border-b border-[#E5E4D9] px-5 py-5">
                      <h2 className="text-lg font-bold text-[#102D38]">
                        Order summary
                      </h2>

                      <p className="mt-1 text-xs text-[#87928B]">
                        Your basket at a glance
                      </p>
                    </div>

                    <div className="space-y-4 p-5">
                      <div className="flex justify-between text-sm text-[#64746F]">
                        <span>Items</span>
                        <span className="font-medium tabular-nums text-[#102D38]">
                          {cart.totalQuantity}
                        </span>
                      </div>

                      <div className="flex justify-between text-sm text-[#64746F]">
                        <span>Available products</span>
                        <span className="font-medium tabular-nums text-[#102D38]">
                          {items.filter((item) => item.available).length}
                        </span>
                      </div>

                      <div className="border-t border-dashed border-[#DCE3DA] pt-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-[#102D38]">
                            Subtotal
                          </span>

                          <span className="text-xl font-bold tabular-nums text-[#102D38]">
                            {formatPrice(cart.subtotalPaise)}
                          </span>
                        </div>

                        <p className="mt-2 text-xs leading-5 text-[#87928B]">
                          Delivery availability and final order details
                          are confirmed during checkout.
                        </p>
                      </div>

                      {hasUnavailableItems ? (
                        <div className="rounded-xl bg-[#FBF4E6] px-4 py-3 text-xs leading-5 text-[#89672F]">
                          Remove unavailable products before proceeding.
                        </div>
                      ) : (
                        <div className="flex items-start gap-2 rounded-xl bg-[#EAF4EF] px-4 py-3 text-xs leading-5 text-[#126E63]">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                          Your available items are ready for the next step.
                        </div>
                      )}

                      <Link
                        href="/checkout"
                        className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#168477] px-5 text-sm font-semibold text-white transition hover:bg-[#126E63]"
                      >
                         Continue to checkout
                        <ArrowRight className="h-4 w-4" />
                      </Link>

                      <Link
                        href="/"
                        className="flex h-12 w-full items-center justify-center rounded-xl border border-[#DCE3DA] text-sm font-semibold text-[#168477] transition hover:border-[#168477] hover:bg-[#F5FAF7]"
                      >
                        Continue shopping
                      </Link>
                    </div>
                  </div>

                  <p className="mt-4 text-center text-[11px] leading-5 text-[#87928B]">
                    Your cart is saved to your Choperz Fresh account.
                  </p>
                </aside>
              </div>
            </>
          )}
      </div>
    </main>
  );
}