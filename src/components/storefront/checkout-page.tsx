"use client";

import { useEffect, useState, type FormEvent } from "react";

import Link from "next/link";

import {

  ArrowLeft,

  ArrowRight,

  CheckCircle2,

  CreditCard,

  Loader2,

  MapPin,


  Package,

  ShieldCheck,

  ShoppingBag,

  Trash2,

  Truck,

} from "lucide-react";

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

      images: {

        url: string;

        alt: string;

      }[];

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

type Address = {

  id: string;

  label: string;

  line1: string;

  line2: string | null;

  landmark: string | null;

  city: string;

  pincode: string;

  latitude: number | null;

  longitude: number | null;

  isDefault: boolean;

};

type AddressDraft = {

  label: string;

  line1: string;

  line2: string;

  landmark: string;

  city: string;

  pincode: string;

  isDefault: boolean;

};

type Order = {

  id: string;

  orderNumber: string;

  status: string;

  paymentStatus: string;

  paymentMethod: string;

  subtotalPaise: number;

  deliveryFeePaise: number;

  discountPaise: number;

  totalPaise: number;

  createdAt: string;

  outlet: {

    name: string;

    distanceKm: number | null;

  };

};

type DeliveryState =

  | "idle"

  | "checking"

  | "covered"

  | "not-covered"

  | "error";

type ApiResult = {

  success?: boolean;

  error?: string;

  cart?: CartData;

  addresses?: Address[];

  address?: Address;

  covered?: boolean;

  newDefaultAddressId?: string | null;

  order?: Order;

};

const initialDraft: AddressDraft = {

  label: "Home",

  line1: "",

  line2: "",

  landmark: "",

  city: "Mysuru",

  pincode: "",

  isDefault: false,

};

const formatPrice = (paise: number) =>

  new Intl.NumberFormat("en-IN", {

    style: "currency",

    currency: "INR",

    maximumFractionDigits: 2,

  }).format(paise / 100);

async function readResponse(response: Response): Promise<ApiResult> {

  return response.json().catch(() => ({

    success: false,

    error: "The server returned an invalid response.",

  }));

}

export function CheckoutPage() {

  const [cart, setCart] = useState<CartData | null>(null);

  const [addresses, setAddresses] = useState<Address[]>([]);

  const [selectedAddressId, setSelectedAddressId] = useState("");

  const [loading, setLoading] = useState(true);

  const [requiresLogin, setRequiresLogin] = useState(false);

  const [loadError, setLoadError] = useState("");

  const [showAddressForm, setShowAddressForm] = useState(false);

  const [draft, setDraft] = useState<AddressDraft>(initialDraft);

  const [savingAddress, setSavingAddress] = useState(false);

  const [addressError, setAddressError] = useState("");
  const [deletingAddressId, setDeletingAddressId] = useState<string | null>(null);
  const [addressActionError, setAddressActionError] = useState("");

  const [deliveryState, setDeliveryState] =

    useState<DeliveryState>("idle");

  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const [checkoutError, setCheckoutError] = useState("");

  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  const selectedAddress = addresses.find(

    (address) => address.id === selectedAddressId

  );

  const selectedDeliveryAddressId = selectedAddress?.id ?? "";
  const selectedDeliveryPincode = selectedAddress?.pincode ?? "";
  const hasValidSelectedPincode = /^\d{6}$/.test(selectedDeliveryPincode);
  const visibleDeliveryState: DeliveryState = hasValidSelectedPincode ? deliveryState : "idle";

  // Load the customer's cart and saved addresses.

  useEffect(() => {

    const controller = new AbortController();

    async function loadCheckout() {

      setLoading(true);

      setLoadError("");

      try {

        const [cartResponse, addressResponse] = await Promise.all([

          fetch("/api/cart", {

            credentials: "include",

            cache: "no-store",

            signal: controller.signal,

          }),

          fetch("/api/customer/addresses", {

            credentials: "include",

            cache: "no-store",

            signal: controller.signal,

          }),

        ]);

        const [cartData, addressData] = await Promise.all([

          readResponse(cartResponse),

          readResponse(addressResponse),

        ]);

        if (

          cartResponse.status === 401 ||

          cartResponse.status === 403 ||

          addressResponse.status === 401 ||

          addressResponse.status === 403

        ) {

          setRequiresLogin(true);

          return;

        }

        if (

          !cartResponse.ok ||

          !cartData.success ||

          !cartData.cart

        ) {

          throw new Error(

            cartData.error || "Unable to load your cart."

          );

        }

        if (

          !addressResponse.ok ||

          !addressData.success ||

          !Array.isArray(addressData.addresses)

        ) {

          throw new Error(

            addressData.error || "Unable to load your addresses."

          );

        }

        const savedAddresses = addressData.addresses;

        setCart(cartData.cart);

        setAddresses(savedAddresses);

        const defaultAddress = savedAddresses.find(

          (address: Address) => address.isDefault

        );

        setSelectedAddressId(

          defaultAddress?.id || savedAddresses[0]?.id || ""

        );

        setShowAddressForm(savedAddresses.length === 0);

      } catch (error) {

        if (controller.signal.aborted) return;

        console.error("Checkout loading failed:", error);

        setLoadError(

          error instanceof Error

            ? error.message

            : "Unable to prepare checkout."

        );

      } finally {

        if (!controller.signal.aborted) {

          setLoading(false);

        }

      }

    }

    void loadCheckout();

    return () => controller.abort();

  }, []);

  // Check the selected address pincode.

  // This is an early availability check, not the final delivery decision.

  useEffect(() => {

    if (!selectedDeliveryPincode) {

      

      return;

    }

    if (!/^\d{6}$/.test(selectedDeliveryPincode)) {

      

      return;

    }

    const controller = new AbortController();

    async function checkDelivery() {

      setDeliveryState("checking");

      try {

        const response = await fetch(

          `/api/delivery/check?pincode=${encodeURIComponent(

            selectedDeliveryPincode

          )}`,

          {

            cache: "no-store",

            signal: controller.signal,

          }

        );

        const data = await readResponse(response);

        if (!response.ok || !data.success) {

          throw new Error(

            data.error || "Unable to check delivery availability."

          );

        }

        setDeliveryState(

          data.covered ? "covered" : "not-covered"

        );

      } catch (error) {

        if (controller.signal.aborted) return;

        console.error("Delivery availability check failed:", error);

        setDeliveryState("error");

      }

    }

    void checkDelivery();

    return () => controller.abort();

  }, [selectedDeliveryAddressId, selectedDeliveryPincode]);

  const canSaveAddress =

    draft.line1.trim().length >= 3 &&

    draft.city.trim().length >= 2 &&

    /^\d{6}$/.test(draft.pincode.trim()) &&
    !savingAddress;

  // Save a delivery address.

  async function saveAddress(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    if (!canSaveAddress) return;

    setSavingAddress(true);

    setAddressError("");

    try {

      const response = await fetch("/api/customer/addresses", {

        method: "POST",

        credentials: "include",

        headers: {

          "Content-Type": "application/json",

        },

        body: JSON.stringify({

          label: draft.label.trim() || "Home",

          line1: draft.line1.trim(),

          line2: draft.line2.trim() || null,

          landmark: draft.landmark.trim() || null,

          city: draft.city.trim(),

          pincode: draft.pincode.trim(),

          isDefault: draft.isDefault,

        }),

      });

      const data = await readResponse(response);

      if (!response.ok || !data.success || !data.address) {

        throw new Error(

          data.error || "Unable to save this address."

        );

      }

      const newAddress = data.address;

      setAddresses((current) => [

        newAddress as Address,

        ...current.filter((item) => item.id !== newAddress.id),

      ]);

      setSelectedAddressId(newAddress.id);

      setDraft(initialDraft);

      setShowAddressForm(false);


    } catch (error) {

      console.error("Address save failed:", error);

      setAddressError(

        error instanceof Error

          ? error.message

          : "Unable to save your address."

      );

    } finally {

      setSavingAddress(false);

    }

  }

  // Remove a saved address using the API's soft-delete endpoint.
  async function deleteAddress(addressId: string) {
    const address = addresses.find((item) => item.id === addressId);

    if (!address || deletingAddressId) return;

    const confirmed = window.confirm(
      `Are you sure you want to remove your ${address.label} address?`
    );

    if (!confirmed) return;

    setDeletingAddressId(addressId);
    setAddressActionError("");

    try {
      const response = await fetch(
        `/api/customer/addresses/${encodeURIComponent(addressId)}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );

      const data = await readResponse(response);

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to remove this address.");
      }

      const remainingAddresses = addresses.filter(
        (item) => item.id !== addressId
      );

      const replacementDefaultId = data.newDefaultAddressId ?? null;
      const updatedAddresses = remainingAddresses.map((item) => ({
        ...item,
        ...(replacementDefaultId
          ? { isDefault: item.id === replacementDefaultId }
          : {}),
      }));

      setAddresses(updatedAddresses);

      if (selectedAddressId === addressId) {
        const replacement =
          updatedAddresses.find((item) => item.id === replacementDefaultId) ||
          updatedAddresses.find((item) => item.isDefault) ||
          updatedAddresses[0];

        setSelectedAddressId(replacement?.id ?? "");
      }

      if (updatedAddresses.length === 0) {
        setShowAddressForm(true);
      }
    } catch (error) {
      console.error("Address deletion failed:", error);
      setAddressActionError(
        error instanceof Error
          ? error.message
          : "Unable to remove this address."
      );
    } finally {
      setDeletingAddressId(null);
    }
  }

  // Place the order using the existing checkout API.

  async function placeOrder() {

    if (

      !cart ||

      !selectedAddress ||


      visibleDeliveryState !== "covered" ||

      cart.items.length === 0 ||

      cart.unavailableItemsCount > 0 ||

      submitting

    ) {

      return;

    }

    setSubmitting(true);

    setCheckoutError("");

    try {

      const response = await fetch("/api/checkout", {

        method: "POST",

        credentials: "include",

        headers: {

          "Content-Type": "application/json",

        },

        body: JSON.stringify({

          addressId: selectedAddress.id,

          paymentMethod: "COD",

          notes: notes.trim() || null,

        }),

      });

      const data = await readResponse(response);

      if (!response.ok || !data.success || !data.order) {

        throw new Error(

          data.error || "Unable to place your order."

        );

      }

      setPlacedOrder(data.order);

      window.dispatchEvent(new Event("choperz:cart-updated"));

    } catch (error) {

      console.error("Checkout submission failed:", error);

      setCheckoutError(

        error instanceof Error

          ? error.message

          : "Something went wrong while placing your order."

      );

    } finally {

      setSubmitting(false);

    }

  }

  // Loading screen

  if (loading) {

    return (

      <main className="min-h-screen bg-[#F6F3EA] px-5 py-12">

        <div className="mx-auto max-w-6xl animate-pulse">

          <div className="h-10 w-72 rounded-lg bg-white" />

          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">

            <div className="h-[500px] rounded-2xl bg-white" />

            <div className="h-80 rounded-2xl bg-white" />

          </div>

        </div>

      </main>

    );

  }

  // Login required

  if (requiresLogin) {

    return (

      <main className="flex min-h-[70vh] items-center justify-center bg-[#F6F3EA] px-5 py-16">

        <div className="max-w-md rounded-3xl border border-[#E5E4D9] bg-white p-8 text-center">

          <ShieldCheck className="mx-auto size-12 text-[#168477]" />

          <h1 className="mt-5 text-2xl font-bold text-[#102D38]">

            Sign in to continue

          </h1>

          <p className="mt-3 text-sm leading-6 text-[#64746F]">

            Your account is needed to view saved addresses and

            place an order.

          </p>

          <Link

            href="/login?callbackUrl=%2Fcheckout"

            className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#168477] px-7 text-sm font-semibold text-white transition hover:bg-[#126E63]"

          >

            Sign in

            <ArrowRight className="size-4" />

          </Link>

        </div>

      </main>

    );

  }

  // Initial loading error

  if (loadError || !cart) {

    return (

      <main className="flex min-h-[70vh] items-center justify-center bg-[#F6F3EA] px-5 py-16">

        <div className="max-w-md rounded-3xl border border-[#E5E4D9] bg-white p-8 text-center">

          <h1 className="text-2xl font-bold text-[#102D38]">

            Checkout couldn&apos;t load

          </h1>

          <p className="mt-3 text-sm text-[#64746F]">

            {loadError || "Please try again."}

          </p>

          <Link

            href="/cart"

            className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-[#168477] px-7 text-sm font-semibold text-white"

          >

            Return to cart

          </Link>

        </div>

      </main>

    );

  }

  // Empty cart

  if (cart.items.length === 0 && !placedOrder) {

    return (

      <main className="flex min-h-[70vh] items-center justify-center bg-[#F6F3EA] px-5 py-16">

        <div className="max-w-md rounded-3xl border border-[#E5E4D9] bg-white p-8 text-center">

          <ShoppingBag className="mx-auto size-12 text-[#168477]" />

          <h1 className="mt-5 text-2xl font-bold text-[#102D38]">

            Your cart is empty

          </h1>

          <p className="mt-3 text-sm leading-6 text-[#64746F]">

            Add something fresh to your cart before checking out.

          </p>

          <Link

            href="/products"

            className="mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-[#168477] px-7 text-sm font-semibold text-white"

          >

            Explore products

            <ArrowRight className="size-4" />

          </Link>

        </div>

      </main>

    );

  }

  // Successful order confirmation

  if (placedOrder) {

    return (

      <main className="flex min-h-[75vh] items-center justify-center bg-[#F6F3EA] px-5 py-12">

        <section className="w-full max-w-xl rounded-[28px] border border-[#E2E5DB] bg-white p-7 text-center shadow-sm sm:p-12">

          <div className="mx-auto flex size-20 items-center justify-center rounded-3xl bg-[#DCECE5] text-[#168477]">

            <CheckCircle2 className="size-10" />

          </div>

          <p className="mt-7 text-[10px] font-bold uppercase tracking-[0.2em] text-[#168477]">

            Order successfully placed

          </p>

          <h1 className="mt-3 font-[var(--font-manrope)] text-3xl font-extrabold text-[#102D38] sm:text-4xl">

            Thank you!

          </h1>

          <p className="mt-3 text-sm leading-7 text-[#64746F]">

            Your order has been received. We&apos;ll take care of the

            next steps.

          </p>

          <div className="mt-8 rounded-2xl bg-[#F6F3EA] p-5 text-left">

            <div className="flex items-center justify-between gap-3 border-b border-[#D8E1DC] pb-4">

              <span className="text-xs text-[#87928B]">

                Order number

              </span>

              <span className="text-sm font-bold text-[#102D38]">

                {placedOrder.orderNumber}

              </span>

            </div>

            <div className="flex items-center justify-between gap-3 border-b border-[#D8E1DC] py-4">

              <span className="text-xs text-[#87928B]">

                Payment method

              </span>

              <span className="text-sm font-semibold text-[#102D38]">

                Cash on Delivery

              </span>

            </div>

            <div className="flex items-center justify-between gap-3 border-b border-[#D8E1DC] py-4">

              <span className="text-xs text-[#87928B]">

                Order status

              </span>

              <span className="rounded-full bg-[#DCECE5] px-3 py-1 text-xs font-bold capitalize text-[#126E63]">

                {placedOrder.status}

              </span>

            </div>

            <div className="flex items-center justify-between gap-3 pt-4">

              <span className="text-sm font-semibold text-[#102D38]">

                Order total

              </span>

              <span className="text-xl font-extrabold text-[#102D38]">

                {formatPrice(placedOrder.totalPaise)}

              </span>

            </div>

          </div>

          <p className="mt-5 text-xs leading-6 text-[#87928B]">

            Delivery assignment: {placedOrder.outlet.name}

          </p>

          <Link

            href="/products"

            className="mt-8 inline-flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-[#168477] px-6 text-sm font-bold text-white transition hover:bg-[#126E63]"

          >

            Continue shopping

            <ArrowRight className="size-4" />

          </Link>

          <Link

            href="/"

            className="mt-4 inline-block text-sm font-semibold text-[#168477] hover:text-[#102D38]"

          >

            Back to home

          </Link>

        </section>

      </main>

    );

  }

  const canPlaceOrder =
    Boolean(selectedAddress) &&
    visibleDeliveryState === "covered" &&
    cart.unavailableItemsCount === 0 &&

    !submitting;

  return (

    <main className="min-h-screen bg-[#F6F3EA] pb-20">

      {/* Checkout heading */}

      <section className="border-b border-[#E5E4D9] bg-white">

        <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 lg:py-12">

          <Link

            href="/cart"

            className="mb-6 inline-flex items-center gap-2 text-xs font-semibold text-[#64746F] transition hover:text-[#168477]"

          >

            <ArrowLeft className="size-4" />

            Back to your cart

          </Link>

          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#168477]">

            Almost there

          </p>

          <h1 className="mt-3 font-[var(--font-manrope)] text-3xl font-extrabold tracking-tight text-[#102D38] sm:text-4xl">

            Checkout.

            <span className="text-[#168477]"> Let&apos;s get it fresh.</span>

          </h1>

          <p className="mt-3 text-sm text-[#64746F]">

            Confirm your delivery details and place your order.

          </p>

        </div>

      </section>

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_370px]">

          {/* Left: address and payment */}

          <div className="space-y-7">

            {/* Delivery address */}

            <section className="rounded-2xl border border-[#E5E4D9] bg-white p-5 sm:p-7">

              <div className="flex flex-wrap items-center justify-between gap-3">

                <div className="flex items-center gap-3">

                  <div className="flex size-11 items-center justify-center rounded-xl bg-[#DCECE5] text-[#168477]">

                    <MapPin className="size-5" />

                  </div>

                  <div>

                    <h2 className="text-base font-bold text-[#102D38]">

                      Delivery address

                    </h2>

                    <p className="mt-1 text-xs text-[#87928B]">

                      Where should we deliver your order?

                    </p>

                  </div>

                </div>

                {addresses.length > 0 && (

                  <button

                    type="button"

                    onClick={() => {

                      setShowAddressForm((current) => !current);

                      setAddressError("");

                    }}

                    className="text-xs font-bold text-[#168477] transition hover:text-[#102D38]"

                  >

                    {showAddressForm ? "Cancel" : "+ Add new address"}

                  </button>

                )}

              </div>

              {addressActionError && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-xs text-red-700"
                >
                  {addressActionError}
                </p>
              )}

              {/* Saved addresses */}

              {addresses.length > 0 && (

                <div className="mt-6 space-y-3">

                  {addresses.map((address) => {
                    const selected = selectedAddressId === address.id;
                    const deleting = deletingAddressId === address.id;

                    return (
                      <div
                        key={address.id}
                        className={`flex items-start gap-3 rounded-xl border-2 p-4 transition ${
                          selected
                            ? "border-[#168477] bg-[#F4FAF6]"
                            : "border-[#E5E4D9] bg-white hover:border-[#9FC5B8]"
                        }`}
                      >
                        <label
                          htmlFor={`delivery-address-${address.id}`}
                          className="flex min-w-0 flex-1 cursor-pointer gap-3"
                        >
                          <input
                            id={`delivery-address-${address.id}`}
                            type="radio"
                            name="delivery-address"
                            value={address.id}
                            checked={selected}
                            onChange={() => {
                              setSelectedAddressId(address.id);
                              setCheckoutError("");
                              setAddressActionError("");
                            }}
                            className="mt-1 size-4 accent-[#168477]"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-bold text-[#102D38]">
                                {address.label}
                              </span>

                              {address.isDefault && (
                                <span className="rounded-full bg-[#DCECE5] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#168477]">
                                  Default
                                </span>
                              )}

                              {selected && (
                                <CheckCircle2 className="ml-auto size-4 text-[#168477]" />
                              )}
                            </div>

                            <p className="mt-2 text-xs leading-6 text-[#64746F]">
                              {address.line1}
                              {address.line2 && `, ${address.line2}`}
                              {address.landmark && `, ${address.landmark}`}
                            </p>

                            <p className="text-xs leading-5 text-[#64746F]">
                              {address.city} – {address.pincode}
                            </p>

                          </div>
                        </label>

                        <button
                          type="button"
                          disabled={Boolean(deletingAddressId)}
                          onClick={() => void deleteAddress(address.id)}
                          aria-label={`Remove ${address.label} address`}
                          title="Remove address"
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-[#A46E45] transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {deleting ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                        </button>
                      </div>
                    );
                  })}

                </div>

              )}

              {/* Add address form */}

              {showAddressForm && (

                <form

                  onSubmit={saveAddress}

                  className="mt-6 rounded-2xl border border-[#D8E1DC] bg-[#FBFCF9] p-4 sm:p-5"

                >

                  <h3 className="text-sm font-bold text-[#102D38]">

                    Add a delivery address

                  </h3>

                  <p className="mt-1 text-xs leading-5 text-[#87928B]">
                    Enter your delivery details. We use your six-digit pincode to check whether your area is serviceable.
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">

                    <div>

                      <label

                        htmlFor="address-label"

                        className="mb-2 block text-xs font-semibold text-[#102D38]"

                      >

                        Address label

                      </label>

                      <select

                        id="address-label"

                        value={draft.label}

                        onChange={(event) =>

                          setDraft({

                            ...draft,

                            label: event.target.value,

                          })

                        }

                        className="h-12 w-full rounded-xl border border-[#D8E1DC] bg-white px-3 text-sm outline-none focus:border-[#168477]"

                      >

                        <option>Home</option>

                        <option>Work</option>

                        <option>Other</option>

                      </select>

                    </div>

                    <div>

                      <label

                        htmlFor="address-city"

                        className="mb-2 block text-xs font-semibold text-[#102D38]"

                      >

                        City

                      </label>

                      <input

                        id="address-city"

                        value={draft.city}

                        onChange={(event) =>

                          setDraft({

                            ...draft,

                            city: event.target.value,

                          })

                        }

                        required

                        minLength={2}

                        maxLength={80}

                        placeholder="Mysuru"

                        className="h-12 w-full rounded-xl border border-[#D8E1DC] bg-white px-3 text-sm outline-none focus:border-[#168477]"

                      />

                    </div>

                    <div className="sm:col-span-2">

                      <label

                        htmlFor="address-line1"

                        className="mb-2 block text-xs font-semibold text-[#102D38]"

                      >

                        House / flat / street address

                      </label>

                      <input

                        id="address-line1"

                        value={draft.line1}

                        onChange={(event) =>

                          setDraft({

                            ...draft,

                            line1: event.target.value,

                          })

                        }

                        required

                        minLength={3}

                        maxLength={200}

                        placeholder="House number, building, street"

                        className="h-12 w-full rounded-xl border border-[#D8E1DC] bg-white px-3 text-sm outline-none focus:border-[#168477]"

                      />

                    </div>

                    <div className="sm:col-span-2">

                      <label

                        htmlFor="address-line2"

                        className="mb-2 block text-xs font-semibold text-[#102D38]"

                      >

                        Apartment / area (optional)

                      </label>

                      <input

                        id="address-line2"

                        value={draft.line2}

                        onChange={(event) =>

                          setDraft({

                            ...draft,

                            line2: event.target.value,

                          })

                        }

                        maxLength={200}

                        placeholder="Apartment, layout, locality"

                        className="h-12 w-full rounded-xl border border-[#D8E1DC] bg-white px-3 text-sm outline-none focus:border-[#168477]"

                      />

                    </div>

                    <div>

                      <label

                        htmlFor="address-landmark"

                        className="mb-2 block text-xs font-semibold text-[#102D38]"

                      >

                        Landmark (optional)

                      </label>

                      <input

                        id="address-landmark"

                        value={draft.landmark}

                        onChange={(event) =>

                          setDraft({

                            ...draft,

                            landmark: event.target.value,

                          })

                        }

                        maxLength={120}

                        placeholder="Near..."

                        className="h-12 w-full rounded-xl border border-[#D8E1DC] bg-white px-3 text-sm outline-none focus:border-[#168477]"

                      />

                    </div>

                    <div>

                      <label

                        htmlFor="address-pincode"

                        className="mb-2 block text-xs font-semibold text-[#102D38]"

                      >

                        Pincode

                      </label>

                      <input

                        id="address-pincode"

                        inputMode="numeric"

                        value={draft.pincode}

                        onChange={(event) =>

                          setDraft({

                            ...draft,

                            pincode: event.target.value

                              .replace(/\D/g, "")

                              .slice(0, 6),

                          })

                        }

                        required

                        maxLength={6}

                        placeholder="6-digit pincode"

                        className="h-12 w-full rounded-xl border border-[#D8E1DC] bg-white px-3 text-sm outline-none focus:border-[#168477]"

                      />

                    </div>

                  </div>

                  <label className="mt-5 flex items-center gap-2 text-xs text-[#64746F]">

                    <input

                      type="checkbox"

                      checked={draft.isDefault}

                      onChange={(event) =>

                        setDraft({

                          ...draft,

                          isDefault: event.target.checked,

                        })

                      }

                      className="size-4 accent-[#168477]"

                    />

                    Make this my default delivery address

                  </label>

                  {addressError && (

                    <p

                      role="alert"

                      className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"

                    >

                      {addressError}

                    </p>

                  )}

                  <button

                    type="submit"

                    disabled={!canSaveAddress}

                    className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#168477] px-5 text-sm font-bold text-white transition hover:bg-[#126E63] disabled:cursor-not-allowed disabled:bg-[#AABCB6]"

                  >

                    {savingAddress ? (

                      <>

                        <Loader2 className="size-4 animate-spin" />

                        Saving address...

                      </>

                    ) : (

                      <>

                        Save delivery address

                        <ArrowRight className="size-4" />

                      </>

                    )}

                  </button>

                </form>

              )}

            </section>

            {/* Delivery availability */}

            {selectedAddress && (

              <section className="rounded-2xl border border-[#E5E4D9] bg-white p-5 sm:p-7">

                <div className="flex items-start gap-3">

                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#DCECE5] text-[#168477]">

                    <Truck className="size-5" />

                  </div>

                  <div className="min-w-0 flex-1">

                    <h2 className="text-base font-bold text-[#102D38]">

                      Delivery availability

                    </h2>

                    <p className="mt-1 text-xs leading-5 text-[#87928B]">

                      Checking serviceability for {selectedDeliveryPincode}.

                    </p>

                    <div className="mt-4">

                      {visibleDeliveryState === "checking" && (

                        <p className="flex items-center gap-2 text-xs text-[#64746F]">

                          <Loader2 className="size-4 animate-spin" />

                          Checking your pincode...

                        </p>

                      )}

                      {visibleDeliveryState === "covered" && (

                        <p className="flex items-start gap-2 text-xs leading-5 text-[#126E63]">

                          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />

                          Your pincode is within an active delivery zone.

                        </p>

                      )}

                      {visibleDeliveryState === "not-covered" && (

                        <p className="text-xs leading-5 text-[#A45D45]">

                          Sorry, your pincode is currently outside our

                          active delivery zones.

                        </p>

                      )}

                      {visibleDeliveryState === "error" && (

                        <p className="text-xs leading-5 text-[#A45D45]">

                          We couldn&apos;t check delivery availability.

                          Please try selecting the address again.

                        </p>

                      )}

                    </div>

                    {visibleDeliveryState === "covered" && (

                      <p className="mt-3 text-[10px] leading-5 text-[#87928B]">

                        This confirms pincode coverage. Final order acceptance also depends on outlet stock at the time of ordering.

                      </p>

                    )}

                  </div>

                </div>

              </section>

            )}

            {/* Payment method */}

            <section className="rounded-2xl border border-[#E5E4D9] bg-white p-5 sm:p-7">

              <div className="flex items-center gap-3">

                <div className="flex size-11 items-center justify-center rounded-xl bg-[#DCECE5] text-[#168477]">

                  <CreditCard className="size-5" />

                </div>

                <div>

                  <h2 className="text-base font-bold text-[#102D38]">

                    Payment method

                  </h2>

                  <p className="mt-1 text-xs text-[#87928B]">

                    Choose how you&apos;d like to pay.

                  </p>

                </div>

              </div>

              <div className="mt-5 flex items-center gap-3 rounded-xl border-2 border-[#168477] bg-[#F4FAF6] p-4">

                <div className="flex size-11 items-center justify-center rounded-lg bg-[#DCECE5] text-[#168477]">

                  <Package className="size-5" />

                </div>

                <div className="min-w-0 flex-1">

                  <p className="text-sm font-bold text-[#102D38]">

                    Cash on Delivery

                  </p>

                  <p className="mt-1 text-xs text-[#64746F]">

                    Pay when your order arrives.

                  </p>

                </div>

                <CheckCircle2 className="size-5 text-[#168477]" />

              </div>

              <p className="mt-3 text-[10px] leading-5 text-[#87928B]">

                Online payment is not enabled yet. Cash on Delivery is

                subject to the store&apos;s payment settings.

              </p>

            </section>

            {/* Order notes */}

            <section className="rounded-2xl border border-[#E5E4D9] bg-white p-5 sm:p-7">

              <h2 className="text-base font-bold text-[#102D38]">

                Delivery notes

                <span className="ml-2 text-xs font-normal text-[#87928B]">

                  Optional

                </span>

              </h2>

              <textarea

                value={notes}

                onChange={(event) =>

                  setNotes(event.target.value.slice(0, 500))

                }

                rows={3}

                placeholder="Anything our delivery team should know?"

                className="mt-4 w-full resize-y rounded-xl border border-[#D8E1DC] bg-[#FBFCF9] p-4 text-sm text-[#102D38] outline-none placeholder:text-[#A0AAA4] focus:border-[#168477]"

              />

              <p className="mt-2 text-right text-[10px] text-[#A0AAA4]">

                {notes.length}/500

              </p>

            </section>

          </div>

          {/* Right: order summary */}

          <aside className="lg:sticky lg:top-28">

            <section className="overflow-hidden rounded-2xl border border-[#E5E4D9] bg-white shadow-[0_5px_24px_rgba(16,45,56,0.045)]">

              <div className="border-b border-[#E5E4D9] px-5 py-5">

                <h2 className="text-lg font-bold text-[#102D38]">

                  Your order

                </h2>

                <p className="mt-1 text-xs text-[#87928B]">

                  Review your selected products

                </p>

              </div>

              <div className="max-h-[360px] space-y-4 overflow-y-auto p-5">

                {cart.items.map((item) => (

                  <div key={item.id} className="flex gap-3">

                    <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#DCECE5]">

                      {item.variant.product.images[0]?.url ? (

                        <img

                          src={item.variant.product.images[0].url}

                          alt={

                            item.variant.product.images[0].alt ||

                            item.variant.product.name

                          }

                          className="h-full w-full object-cover"

                        />

                      ) : (

                        <ShoppingBag className="size-6 text-[#168477]" />

                      )}

                    </div>

                    <div className="min-w-0 flex-1">

                      <p className="text-xs font-bold text-[#102D38]">

                        {item.variant.product.name}

                      </p>

                      <p className="mt-1 text-[10px] text-[#87928B]">

                        {item.variant.label} × {item.quantity}

                      </p>

                      {item.cutOption && (

                        <p className="mt-1 text-[10px] text-[#168477]">

                          {item.cutOption.name}

                        </p>

                      )}

                      {!item.available && (

                        <p className="mt-1 text-[10px] text-red-600">

                          Unavailable

                        </p>

                      )}

                    </div>

                    <span className="shrink-0 text-xs font-bold text-[#102D38]">

                      {formatPrice(item.lineTotalPaise)}

                    </span>

                  </div>

                ))}

              </div>

              <div className="space-y-4 border-t border-[#E5E4D9] p-5">

                <div className="flex justify-between text-sm text-[#64746F]">

                  <span>Items</span>

                  <span className="font-semibold text-[#102D38]">

                    {cart.totalQuantity}

                  </span>

                </div>

                <div className="flex justify-between text-sm text-[#64746F]">

                  <span>Subtotal</span>

                  <span className="font-semibold tabular-nums text-[#102D38]">

                    {formatPrice(cart.subtotalPaise)}

                  </span>

                </div>

                <div className="flex justify-between text-sm text-[#64746F]">

                  <span>Delivery</span>

                  <span className="font-semibold text-[#168477]">

                    Free

                  </span>

                </div>

                <div className="flex items-center justify-between border-t border-dashed border-[#D8E1DC] pt-4">

                  <span className="text-sm font-bold text-[#102D38]">

                    Order total

                  </span>

                  <span className="text-2xl font-extrabold tabular-nums text-[#102D38]">

                    {formatPrice(cart.subtotalPaise)}

                  </span>

                </div>

                {cart.unavailableItemsCount > 0 && (

                  <p className="rounded-xl bg-[#FBF4E6] px-3 py-3 text-xs leading-5 text-[#89672F]">

                    {cart.unavailableItemsCount} item(s) are unavailable.

                    Please remove them from your cart before ordering.

                  </p>

                )}
{checkoutError && (

                  <p

                    role="alert"

                    className="rounded-xl bg-red-50 px-3 py-3 text-xs leading-5 text-red-700"

                  >

                    {checkoutError}

                  </p>

                )}

                <button

                  type="button"

                  onClick={() => void placeOrder()}

                  disabled={!canPlaceOrder}

                  className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#168477] px-5 text-sm font-bold text-white transition hover:bg-[#126E63] disabled:cursor-not-allowed disabled:bg-[#AABCB6]"

                >

                  {submitting ? (

                    <>

                      <Loader2 className="size-5 animate-spin" />

                      Placing your order...

                    </>

                  ) : (

                    <>

                      Place order

                      <ArrowRight className="size-4" />

                    </>

                  )}

                </button>

                <p className="text-center text-[10px] leading-5 text-[#87928B]">

                  Your order, address, stock and delivery eligibility

                  are validated by Choperz Fresh before confirmation.

                </p>

              </div>

            </section>

            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#E5E4D9] bg-white p-4">

              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#168477]" />

              <p className="text-[11px] leading-5 text-[#87928B]">

                Your order is created securely through your Choperz

                Fresh account. Prices and stock are rechecked by the

                server at checkout.

              </p>

            </div>

            <Link

              href="/cart"

              className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-[#168477] transition hover:text-[#102D38]"

            >

              <ArrowLeft className="size-4" />

              Return to cart

            </Link>

          </aside>

        </div>

      </div>

    </main>

  );

}
