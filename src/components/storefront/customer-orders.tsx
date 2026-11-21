"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  RefreshCw,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "packed"
  | "picked_up"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

type PaymentStatus =
  | "UNPAID"
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

type OrderPreviewItem = {
  productName: string;
  variantLabel: string;
  quantity: number;
};

type CustomerOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "RAZORPAY" | "COD";
  subtotalPaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  totalPaise: number;
  shipName: string;
  shipCity: string;
  shipPincode: string;
  createdAt: string;
  updatedAt: string;
  outlet: { name: string } | null;
  itemCount: number;
  itemsPreview: OrderPreviewItem[];
};

type OrderDetailItem = {
  id: string;
  productName: string;
  variantLabel: string;
  weightGrams: number;
  quantity: number;
  unitPricePaise: number;
  cutName: string | null;
  cutExtraPaise: number;
  lineTotalPaise: number;
};

type OrderHistoryItem = {
  fromStatus: string | null;
  toStatus: string;
  createdAt: string;
};

type CustomerOrderDetail = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: "RAZORPAY" | "COD";
  subtotalPaise: number;
  deliveryFeePaise: number;
  discountPaise: number;
  totalPaise: number;
  shipName: string;
  shipPhone: string;
  shipLine1: string;
  shipLine2: string | null;
  shipLandmark: string | null;
  shipCity: string;
  shipPincode: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  outlet: { name: string } | null;
  items: OrderDetailItem[];
  history: OrderHistoryItem[];
};

type ListResponse = {
  success?: boolean;
  error?: string;
  orders?: CustomerOrder[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type DetailResponse = {
  success?: boolean;
  error?: string;
  order?: CustomerOrderDetail;
};

type CancelResponse = {
  success?: boolean;
  error?: string;
  message?: string;
};

const PAGE_SIZE = 10;

const statusLabels: Record<OrderStatus, string> = {
  pending: "Order placed",
  confirmed: "Confirmed",
  processing: "Being prepared",
  packed: "Packed",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const paymentLabels: Record<PaymentStatus, string> = {
  UNPAID: "Awaiting payment",
  PENDING: "Payment pending",
  PAID: "Paid",
  FAILED: "Payment failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
};

const statusStyles: Record<OrderStatus, string> = {
  pending: "border-[#F0DDBA] bg-[#FBF3E5] text-[#936A2B]",
  confirmed: "border-[#C9E4D8] bg-[#EAF5EF] text-[#26765F]",
  processing: "border-[#C9E4D8] bg-[#EAF5EF] text-[#26765F]",
  packed: "border-[#C9E4D8] bg-[#EAF5EF] text-[#26765F]",
  picked_up: "border-[#C9DCE7] bg-[#EEF5F8] text-[#416C80]",
  out_for_delivery: "border-[#C9DCE7] bg-[#EEF5F8] text-[#416C80]",
  delivered: "border-[#C9E4D8] bg-[#EAF5EF] text-[#26765F]",
  cancelled: "border-[#E8D1CC] bg-[#FBEEEB] text-[#A24E3E]",
};

const statusOptions: { value: "" | OrderStatus; label: string }[] = [
  { value: "", label: "All orders" },
  { value: "pending", label: "Order placed" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Being prepared" },
  { value: "packed", label: "Packed" },
  { value: "picked_up", label: "Picked up" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const progressStatuses: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "packed",
  "picked_up",
  "out_for_delivery",
  "delivered",
];

function formatMoney(paise: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(paise / 100);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatWeight(grams: number) {
  return grams >= 1000
    ? (grams / 1000).toLocaleString("en-IN") + " kg"
    : grams + " g";
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

function OrderStatusPill({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[10px] font-bold ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}

function PaymentPill({ status }: { status: PaymentStatus }) {
  const isPaid = status === "PAID";
  const isFailed = status === "FAILED";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
      isPaid
        ? "bg-[#EAF5EF] text-[#26765F]"
        : isFailed
          ? "bg-[#FBEEEB] text-[#A24E3E]"
          : "bg-[#F2F4F0] text-[#687A73]"
    }`}>
      {isPaid && <BadgeCheck className="size-3" />}
      {paymentLabels[status]}
    </span>
  );
}

function OrderSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((item) => (
        <div key={item} className="animate-pulse rounded-[24px] border border-[#E4E7DE] bg-white p-6">
          <div className="h-3 w-32 rounded bg-[#E9EEE8]" />
          <div className="mt-4 h-5 w-48 rounded bg-[#E9EEE8]" />
          <div className="mt-6 h-3 w-full max-w-md rounded bg-[#E9EEE8]" />
          <div className="mt-5 h-10 w-36 rounded-full bg-[#E9EEE8]" />
        </div>
      ))}
    </div>
  );
}

export function CustomerOrders() {
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [requiresLogin, setRequiresLogin] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"" | OrderStatus>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedOrder, setSelectedOrder] = useState<CustomerOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [cancelNotice, setCancelNotice] = useState("");

  const loadOrders = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (statusFilter) query.set("status", statusFilter);

      const response = await fetch("/api/customer/orders?" + query.toString(), {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const data = await readJson<ListResponse>(response);

      if (response.status === 401) {
        setRequiresLogin(true);
        setOrders([]);
        return;
      }
      if (response.status === 403) {
        throw new Error(data.error || "A verified customer account is required.");
      }
      if (!response.ok || !data.success || !data.orders || !data.pagination) {
        throw new Error(data.error || "Unable to load your orders.");
      }

      setRequiresLogin(false);
      setOrders(data.orders);
      setTotal(data.pagination.total);
      setTotalPages(Math.max(1, data.pagination.totalPages));
    } catch (err) {
      console.error("Customer orders load failed:", err);
      setError(err instanceof Error ? err.message : "Unable to load your orders.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    void Promise.resolve().then(() => loadOrders());
  }, [loadOrders]);

  async function openOrder(orderId: string) {
    setSelectedOrder(null);
    setDetailError("");
    setCancelError("");
    setCancelNotice("");
    setDetailLoading(true);

    try {
      const response = await fetch(
        "/api/customer/orders/" + encodeURIComponent(orderId),
        { method: "GET", credentials: "include", cache: "no-store" }
      );
      const data = await readJson<DetailResponse>(response);

      if (response.status === 401) {
        setRequiresLogin(true);
        throw new Error("Please sign in again to view this order.");
      }
      if (!response.ok || !data.success || !data.order) {
        throw new Error(data.error || "Unable to load this order.");
      }

      setSelectedOrder(data.order);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Unable to load this order.");
    } finally {
      setDetailLoading(false);
    }
  }

  async function cancelOrder() {
    if (!selectedOrder || cancelling) return;

    const confirmed = window.confirm(
      "Cancel order " + selectedOrder.orderNumber + "? This cannot be undone."
    );
    if (!confirmed) return;

    setCancelling(true);
    setCancelError("");
    setCancelNotice("");

    try {
      const response = await fetch(
        "/api/customer/orders/" + encodeURIComponent(selectedOrder.id),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: "Cancelled by customer from order history." }),
        }
      );
      const data = await readJson<CancelResponse>(response);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to cancel this order.");
      }

      setCancelNotice(data.message || "Your order has been cancelled.");
      await loadOrders(false);
      await openOrder(selectedOrder.id);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Unable to cancel this order.");
    } finally {
      setCancelling(false);
    }
  }

  const activeOnPage = useMemo(
    () => orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length,
    [orders]
  );
  const deliveredOnPage = useMemo(
    () => orders.filter((order) => order.status === "delivered").length,
    [orders]
  );

  const canCancel =
    selectedOrder?.status === "pending" &&
    (selectedOrder.paymentStatus === "UNPAID" || selectedOrder.paymentStatus === "FAILED");

  return (
    <>
      <main className="min-h-[calc(100vh-124px)] bg-[#F6F3EA] px-4 py-10 sm:px-7 sm:py-14 lg:px-12">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#168477]">
                Your Choperz space
              </p>
              <h1 className="mt-2 font-[family-name:var(--font-manrope)] text-3xl font-extrabold tracking-[-0.055em] text-[#102D38] sm:text-4xl">
                Your orders<span className="text-[#168477]">.</span>
              </h1>
              <p className="mt-2 text-sm text-[#6C7C7C]">
                Follow every order from the coast to your doorstep.
              </p>
            </div>
            <Link
              href="/account"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[#C9D8D0] bg-white/70 px-5 text-xs font-bold text-[#102D38] transition hover:border-[#168477] hover:text-[#168477]"
            >
              <ArrowLeft className="size-4" /> Back to account
            </Link>
          </div>

          {requiresLogin ? (
            <section className="mx-auto flex min-h-[380px] max-w-xl flex-col items-center justify-center rounded-[28px] border border-[#E2E4D9] bg-white px-6 py-12 text-center shadow-[0_18px_60px_rgba(16,45,56,0.05)]">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-[#DCECE5] text-[#168477]">
                <ShoppingBag className="size-7" />
              </div>
              <h2 className="mt-6 font-[family-name:var(--font-manrope)] text-2xl font-extrabold text-[#102D38]">
                Your orders are waiting
              </h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-[#71817D]">
                Sign in with your verified mobile number to see your order history and delivery updates.
              </p>
              <Link
                href="/login?callbackUrl=%2Faccount%2Forders"
                className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-[#168477] px-7 text-sm font-bold text-white transition hover:bg-[#102D38]"
              >
                Sign in to view orders <ArrowRight className="size-4" />
              </Link>
            </section>
          ) : (
            <>
              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-[#E2E4D9] bg-white p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#87928B]">All your orders</p>
                  <p className="mt-2 font-[family-name:var(--font-manrope)] text-3xl font-extrabold text-[#102D38]">{total}</p>
                  <p className="mt-1 text-[11px] text-[#87928B]">Across your Choperz account</p>
                </div>
                <div className="rounded-[22px] border border-[#E2E4D9] bg-white p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#87928B]">In progress</p>
                  <p className="mt-2 font-[family-name:var(--font-manrope)] text-3xl font-extrabold text-[#168477]">{activeOnPage}</p>
                  <p className="mt-1 text-[11px] text-[#87928B]">On this page</p>
                </div>
                <div className="rounded-[22px] border border-[#E2E4D9] bg-white p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#87928B]">Delivered</p>
                  <p className="mt-2 font-[family-name:var(--font-manrope)] text-3xl font-extrabold text-[#102D38]">{deliveredOnPage}</p>
                  <p className="mt-1 text-[11px] text-[#87928B]">On this page</p>
                </div>
              </div>

              <section className="overflow-hidden rounded-[26px] border border-[#E2E4D9] bg-white shadow-[0_18px_60px_rgba(16,45,56,0.035)]">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#E9ECE5] px-5 py-5 sm:px-7">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#168477]">Order history</p>
                    <h2 className="mt-1 font-[family-name:var(--font-manrope)] text-xl font-extrabold text-[#102D38]">
                      Every fresh find, listed
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="order-status-filter" className="sr-only">Filter orders by status</label>
                    <select
                      id="order-status-filter"
                      value={statusFilter}
                      onChange={(event) => {
                        setStatusFilter(event.target.value as "" | OrderStatus);
                        setPage(1);
                      }}
                      className="h-10 rounded-full border border-[#D8E1DC] bg-[#FBFCF9] px-4 text-xs font-semibold text-[#52666A] outline-none transition focus:border-[#168477] focus:ring-2 focus:ring-[#168477]/10"
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value || "all"} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void loadOrders()}
                      disabled={loading}
                      className="flex size-10 items-center justify-center rounded-full border border-[#D8E1DC] text-[#168477] transition hover:bg-[#F2F7F3] disabled:opacity-50"
                      aria-label="Refresh orders"
                    >
                      <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="m-5 flex items-start gap-3 rounded-xl border border-[#E8D7C9] bg-[#FFFAF5] px-4 py-3 sm:m-7">
                    <CircleAlert className="mt-0.5 size-4 shrink-0 text-[#B66C43]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#8F513A]">{error}</p>
                      <button type="button" onClick={() => void loadOrders()} className="mt-2 text-xs font-bold text-[#168477] underline underline-offset-4">
                        Try again
                      </button>
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="p-5 sm:p-7"><OrderSkeleton /></div>
                ) : !error && orders.length === 0 ? (
                  <div className="px-6 py-16 text-center">
                    <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-[#DCECE5] text-[#168477]">
                      <Package className="size-7" />
                    </div>
                    <h3 className="mt-5 font-[family-name:var(--font-manrope)] text-xl font-extrabold text-[#102D38]">
                      {statusFilter ? "No orders with this status" : "Your first fresh order starts here"}
                    </h3>
                    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#71817D]">
                      {statusFilter
                        ? "Choose another status filter to see more of your order history."
                        : "When you place an order with Choperz Fresh, you can follow its progress here."}
                    </p>
                    <Link
                      href="/products"
                      className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-[#168477] px-6 text-xs font-bold text-white transition hover:bg-[#102D38]"
                    >
                      Explore the catalogue <ArrowRight className="size-4" />
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-[#EDF0EA]">
                    {orders.map((order) => (
                      <article key={order.id} className="px-5 py-6 transition hover:bg-[#FCFDFB] sm:px-7">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#87928B]">Order number</p>
                            <p className="mt-1 break-all font-[family-name:var(--font-manrope)] text-sm font-extrabold text-[#102D38]">{order.orderNumber}</p>
                            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#87928B]">
                              <CalendarDays className="size-3.5" /> {formatDate(order.createdAt)}
                            </p>
                          </div>
                          <OrderStatusPill status={order.status} />
                        </div>

                        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-xs font-semibold text-[#52666A]">
                              <Package className="size-4 text-[#168477]" />
                              {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                              <span className="text-[#B0BAB3]">•</span>
                              {order.itemsPreview.slice(0, 2).map((item) => item.productName).join(", ")}
                              {order.itemCount > order.itemsPreview.length && (
                                <span className="shrink-0 text-[#87928B]">+{order.itemCount - order.itemsPreview.length} more</span>
                              )}
                            </div>
                            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-[#87928B]">
                              <MapPin className="size-3.5" /> {order.shipCity} · {order.shipPincode}
                            </p>
                            <div className="mt-3"><PaymentPill status={order.paymentStatus} /></div>
                          </div>
                          <div className="flex w-full items-center justify-between gap-4 border-t border-[#EDF0EA] pt-4 sm:w-auto sm:justify-end sm:border-0 sm:pt-0">
                            <div className="sm:text-right">
                              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#87928B]">Order total</p>
                              <p className="mt-1 font-[family-name:var(--font-manrope)] text-xl font-extrabold tabular-nums text-[#102D38]">{formatMoney(order.totalPaise)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => void openOrder(order.id)}
                              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#C9D8D0] px-4 text-xs font-bold text-[#168477] transition hover:border-[#168477] hover:bg-[#F1F7F3]"
                            >
                              View details <ArrowRight className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}

                {!loading && totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E9ECE5] px-5 py-4 sm:px-7">
                    <p className="text-xs text-[#87928B]">
                      Page <span className="font-bold text-[#52666A]">{page}</span> of <span className="font-bold text-[#52666A]">{totalPages}</span> · {total} orders
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={page <= 1 || loading}
                        onClick={() => setPage((current) => Math.max(1, current - 1))}
                        className="inline-flex h-9 items-center gap-1 rounded-full border border-[#D8E1DC] px-3 text-xs font-semibold text-[#52666A] transition hover:bg-[#F6F8F4] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ChevronLeft className="size-4" /> Previous
                      </button>
                      <button
                        type="button"
                        disabled={page >= totalPages || loading}
                        onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                        className="inline-flex h-9 items-center gap-1 rounded-full border border-[#D8E1DC] px-3 text-xs font-semibold text-[#52666A] transition hover:bg-[#F6F8F4] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next <ChevronRight className="size-4" />
                      </button>
                    </div>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>

      {(selectedOrder || detailLoading || detailError) && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-[#07171D]/65 p-3 py-6 sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !cancelling) {
              setSelectedOrder(null);
              setDetailError("");
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-detail-title"
            className="my-auto w-full max-w-3xl overflow-hidden rounded-[26px] bg-[#F9FAF6] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#E5EAE3] bg-white px-5 py-4 sm:px-7">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#168477]">Order details</p>
                <h2 id="order-detail-title" className="mt-1 font-[family-name:var(--font-manrope)] text-lg font-extrabold text-[#102D38]">
                  {selectedOrder?.orderNumber || "Loading order"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedOrder(null);
                  setDetailError("");
                  setCancelError("");
                  setCancelNotice("");
                }}
                className="flex size-10 items-center justify-center rounded-full border border-[#D8E1DC] bg-white text-[#52666A] transition hover:bg-[#F2F6F2]"
                aria-label="Close order details"
                disabled={cancelling}
              >
                <X className="size-4" />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex min-h-[360px] items-center justify-center">
                <div className="text-center">
                  <Loader2 className="mx-auto size-7 animate-spin text-[#168477]" />
                  <p className="mt-3 text-sm text-[#71817D]">Loading order details…</p>
                </div>
              </div>
            ) : detailError ? (
              <div className="p-7">
                <div className="flex items-start gap-3 rounded-xl border border-[#E8D7C9] bg-white p-4">
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-[#B66C43]" />
                  <p className="text-sm text-[#8F513A]">{detailError}</p>
                </div>
              </div>
            ) : selectedOrder ? (
              <div className="max-h-[calc(100vh-145px)] overflow-y-auto p-5 sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8E0] bg-white p-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#87928B]">Placed on</p>
                    <p className="mt-1 text-sm font-bold text-[#102D38]">{formatDate(selectedOrder.createdAt)}</p>
                  </div>
                  <OrderStatusPill status={selectedOrder.status} />
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                  <section className="rounded-2xl border border-[#E2E8E0] bg-white p-5">
                    <div className="flex items-center gap-2">
                      <Package className="size-4 text-[#168477]" />
                      <h3 className="text-sm font-extrabold text-[#102D38]">Items in this order</h3>
                    </div>
                    <div className="mt-4 divide-y divide-[#EDF0EA]">
                      {selectedOrder.items.map((item) => (
                        <div key={item.id} className="py-4 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-[#102D38]">{item.productName}</p>
                              <p className="mt-1 text-xs text-[#71817D]">{item.variantLabel} · {formatWeight(item.weightGrams)}</p>
                              {item.cutName && <p className="mt-1 text-[11px] text-[#168477]">Cut preference: {item.cutName}</p>}
                              <p className="mt-1 text-[11px] text-[#87928B]">Qty {item.quantity} · {formatMoney(item.unitPricePaise + item.cutExtraPaise)} each</p>
                            </div>
                            <p className="shrink-0 text-sm font-extrabold tabular-nums text-[#102D38]">{formatMoney(item.lineTotalPaise)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="space-y-4">
                    <section className="rounded-2xl border border-[#E2E8E0] bg-white p-5">
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 text-[#168477]" />
                        <h3 className="text-sm font-extrabold text-[#102D38]">Delivery address</h3>
                      </div>
                      <p className="mt-3 text-sm font-bold text-[#102D38]">{selectedOrder.shipName}</p>
                      <p className="mt-1 text-xs leading-5 text-[#71817D]">
                        {[selectedOrder.shipLine1, selectedOrder.shipLine2, selectedOrder.shipLandmark, selectedOrder.shipCity, selectedOrder.shipPincode].filter(Boolean).join(", ")}
                      </p>
                      <p className="mt-3 text-xs text-[#71817D]">Mobile: {selectedOrder.shipPhone}</p>
                      {selectedOrder.outlet?.name && <p className="mt-2 text-[11px] text-[#87928B]">Fulfilled by {selectedOrder.outlet.name}</p>}
                    </section>

                    <section className="rounded-2xl border border-[#E2E8E0] bg-white p-5">
                      <div className="flex items-center gap-2">
                        <CreditCard className="size-4 text-[#168477]" />
                        <h3 className="text-sm font-extrabold text-[#102D38]">Payment summary</h3>
                      </div>
                      <div className="mt-4 space-y-2.5 text-xs">
                        <div className="flex justify-between gap-3 text-[#71817D]"><span>Subtotal</span><span className="font-semibold text-[#102D38]">{formatMoney(selectedOrder.subtotalPaise)}</span></div>
                        <div className="flex justify-between gap-3 text-[#71817D]"><span>Delivery</span><span className="font-semibold text-[#102D38]">{selectedOrder.deliveryFeePaise === 0 ? "Free" : formatMoney(selectedOrder.deliveryFeePaise)}</span></div>
                        {selectedOrder.discountPaise > 0 && <div className="flex justify-between gap-3 text-[#26765F]"><span>Discount</span><span className="font-semibold">−{formatMoney(selectedOrder.discountPaise)}</span></div>}
                        <div className="flex justify-between gap-3 border-t border-dashed border-[#DCE3DA] pt-3 text-sm font-extrabold text-[#102D38]"><span>Total</span><span className="tabular-nums">{formatMoney(selectedOrder.totalPaise)}</span></div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EDF0EA] pt-3">
                        <PaymentPill status={selectedOrder.paymentStatus} />
                        <span className="text-[10px] font-semibold text-[#71817D]">{selectedOrder.paymentMethod === "COD" ? "Cash on delivery" : "Online payment"}</span>
                      </div>
                    </section>
                  </div>
                </div>

                <section className="mt-5 rounded-2xl border border-[#E2E8E0] bg-white p-5">
                  <div className="flex items-center gap-2">
                    <Truck className="size-4 text-[#168477]" />
                    <h3 className="text-sm font-extrabold text-[#102D38]">Order progress</h3>
                  </div>
                  {selectedOrder.status === "cancelled" ? (
                    <div className="mt-4 flex items-center gap-3 rounded-xl bg-[#FBEEEB] p-4 text-[#A24E3E]">
                      <X className="size-4" />
                      <p className="text-xs font-semibold">This order has been cancelled.</p>
                    </div>
                  ) : (
                    <ol className="mt-5 grid gap-3 sm:grid-cols-4 lg:grid-cols-7">
                      {progressStatuses.map((status, index) => {
                        const currentIndex = progressStatuses.indexOf(selectedOrder.status);
                        const completed = currentIndex >= index;
                        const event = selectedOrder.history.find((item) => item.toStatus === status);
                        return (
                          <li key={status} className="min-w-0">
                            <div className={`mb-2 flex size-7 items-center justify-center rounded-full ${completed ? "bg-[#168477] text-white" : "bg-[#EDF1EC] text-[#A1AEA6]"}`}>
                              {completed ? <Check className="size-3.5" /> : <span className="text-[10px] font-bold">{index + 1}</span>}
                            </div>
                            <p className={`text-[10px] font-bold leading-4 ${completed ? "text-[#26765F]" : "text-[#94A098]"}`}>{statusLabels[status]}</p>
                            {event && <p className="mt-1 text-[9px] leading-4 text-[#87928B]">{formatDate(event.createdAt)}</p>}
                          </li>
                        );
                      })}
                    </ol>
                  )}
                  {selectedOrder.notes && <p className="mt-4 rounded-lg bg-[#F6F8F4] p-3 text-xs leading-5 text-[#71817D]">Your note: {selectedOrder.notes}</p>}
                </section>

                {cancelNotice && (
                  <div className="mt-5 flex items-center gap-2 rounded-xl border border-[#C9E4D8] bg-[#EAF5EF] px-4 py-3 text-xs font-semibold text-[#26765F]">
                    <Check className="size-4" /> {cancelNotice}
                  </div>
                )}
                {cancelError && (
                  <div className="mt-5 flex items-start gap-2 rounded-xl border border-[#E8D7C9] bg-[#FFFAF5] px-4 py-3 text-xs font-semibold text-[#8F513A]">
                    <CircleAlert className="mt-0.5 size-4 shrink-0" /> {cancelError}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] leading-5 text-[#87928B]">
                    Need help? Contact Choperz Fresh support with your order number.
                  </p>
                  {canCancel && (
                    <button
                      type="button"
                      onClick={() => void cancelOrder()}
                      disabled={cancelling}
                      className="inline-flex h-10 items-center gap-2 rounded-full border border-[#E7C9C1] px-4 text-xs font-bold text-[#A24E3E] transition hover:bg-[#FBEEEB] disabled:opacity-50"
                    >
                      {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
                      {cancelling ? "Cancelling…" : "Cancel order"}
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}
