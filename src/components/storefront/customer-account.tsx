"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  CircleAlert,
  Clock3,
  Loader2,
  LogIn,
  Package,
  PencilLine,
  Phone,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";

type CustomerProfile = {
  id: string;
  name: string;
  phoneNumber: string | null;
  phoneNumberVerified: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  message?: string;
  profile?: CustomerProfile;
};

async function readResponse(response: Response): Promise<ApiResponse> {
  return response.json().catch(() => ({
    success: false,
    error: "The server returned an invalid response.",
  }));
}

function formatMemberSince(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Choperz Fresh customer";

  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function CustomerAccount() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [requiresLogin, setRequiresLogin] = useState(false);

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      setLoading(true);
      setLoadError("");

      try {
        const response = await fetch("/api/customer/profile", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await readResponse(response);

        if (response.status === 401) {
          setRequiresLogin(true);
          return;
        }

        if (response.status === 403) {
          throw new Error(
            data.error || "A verified customer account is required."
          );
        }

        if (!response.ok || !data.success || !data.profile) {
          throw new Error(data.error || "Unable to load your account.");
        }

        setProfile(data.profile);
        setNameDraft(data.profile.name || "");
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Customer profile load failed:", error);
        setLoadError(
          error instanceof Error ? error.message : "Unable to load your account."
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadProfile();
    return () => controller.abort();
  }, []);

  const memberSince = useMemo(
    () => (profile ? formatMemberSince(profile.createdAt) : ""),
    [profile]
  );

  function beginEditing() {
    if (!profile) return;
    setNameDraft(profile.name);
    setSaveError("");
    setSaveSuccess("");
    setEditing(true);
  }

  function cancelEditing() {
    setNameDraft(profile?.name ?? "");
    setSaveError("");
    setEditing(false);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || saving) return;

    const cleanName = nameDraft.trim();
    if (cleanName.length < 1 || cleanName.length > 80) {
      setSaveError("Enter a name between 1 and 80 characters.");
      return;
    }

    if (cleanName === profile.name) {
      setEditing(false);
      return;
    }

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const response = await fetch("/api/customer/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName }),
      });
      const data = await readResponse(response);

      if (response.status === 401) {
        setRequiresLogin(true);
        return;
      }

      if (!response.ok || !data.success || !data.profile) {
        throw new Error(data.error || "Unable to save your changes.");
      }

      setProfile(data.profile);
      setNameDraft(data.profile.name);
      setEditing(false);
      setSaveSuccess("Your profile has been updated.");
    } catch (error) {
      console.error("Customer profile update failed:", error);
      setSaveError(
        error instanceof Error ? error.message : "Unable to save your changes."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-[calc(100vh-124px)] bg-[#F6F3EA] px-4 py-10 sm:px-7 sm:py-14 lg:px-12">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#168477]">
              Your Choperz space
            </p>
            <h1 className="mt-2 font-[family-name:var(--font-manrope)] text-3xl font-extrabold tracking-[-0.055em] text-[#102D38] sm:text-4xl">
              My account<span className="text-[#168477]">.</span>
            </h1>
            <p className="mt-2 text-sm text-[#6C7C7C]">
              Your details, orders and everything fresh.
            </p>
          </div>
          <Link
            href="/products"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-[#C9D8D0] bg-white/70 px-5 text-xs font-bold text-[#102D38] transition hover:border-[#168477] hover:text-[#168477]"
          >
            Continue shopping <ArrowRight className="size-4" />
          </Link>
        </div>

        {loading ? (
          <div className="flex min-h-[360px] items-center justify-center rounded-[28px] border border-[#E2E4D9] bg-white">
            <div className="text-center">
              <Loader2 className="mx-auto size-7 animate-spin text-[#168477]" />
              <p className="mt-4 text-sm text-[#71817D]">Loading your account...</p>
            </div>
          </div>
        ) : requiresLogin ? (
          <section className="mx-auto flex min-h-[380px] max-w-xl flex-col items-center justify-center rounded-[28px] border border-[#E2E4D9] bg-white px-6 py-12 text-center shadow-[0_18px_60px_rgba(16,45,56,0.05)]">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-[#DCECE5] text-[#168477]">
              <UserRound className="size-7" />
            </div>
            <h2 className="mt-6 font-[family-name:var(--font-manrope)] text-2xl font-extrabold text-[#102D38]">
              Your account is waiting
            </h2>
            <p className="mt-2 max-w-sm text-sm leading-6 text-[#71817D]">
              Sign in with your verified mobile number to view and manage your Choperz Fresh account.
            </p>
            <Link
              href="/login?callbackUrl=%2Faccount"
              className="mt-7 inline-flex h-12 items-center gap-2 rounded-full bg-[#168477] px-7 text-sm font-bold text-white transition hover:bg-[#102D38]"
            >
              <LogIn className="size-4" /> Sign in to your account
            </Link>
          </section>
        ) : loadError ? (
          <section className="rounded-[28px] border border-[#E8D7C9] bg-white p-7 sm:p-10">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-[#B66C43]" />
              <div>
                <h2 className="font-[family-name:var(--font-manrope)] text-lg font-bold text-[#102D38]">
                  We couldn't load your account
                </h2>
                <p className="mt-1 text-sm leading-6 text-[#71817D]">{loadError}</p>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="mt-4 text-sm font-bold text-[#168477] underline underline-offset-4"
                >
                  Try again
                </button>
              </div>
            </div>
          </section>
        ) : profile ? (
          <div className="grid gap-6 lg:grid-cols-[1.35fr_0.85fr]">
            <section className="overflow-hidden rounded-[28px] border border-[#E2E4D9] bg-white shadow-[0_18px_60px_rgba(16,45,56,0.045)]">
              <div className="flex items-center justify-between border-b border-[#E9ECE5] px-6 py-5 sm:px-8">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#168477]">
                    Personal information
                  </p>
                  <h2 className="mt-1 font-[family-name:var(--font-manrope)] text-xl font-extrabold text-[#102D38]">
                    Account details
                  </h2>
                </div>
                {!editing && (
                  <button
                    type="button"
                    onClick={beginEditing}
                    className="inline-flex h-10 items-center gap-2 rounded-full border border-[#D8E1DC] px-4 text-xs font-bold text-[#168477] transition hover:border-[#168477] hover:bg-[#F3F8F5]"
                  >
                    <PencilLine className="size-3.5" /> Edit
                  </button>
                )}
              </div>

              <div className="p-6 sm:p-8">
                {saveSuccess && (
                  <div className="mb-5 flex items-center gap-2 rounded-xl bg-[#EAF5EF] px-4 py-3 text-xs font-semibold text-[#147568]">
                    <Check className="size-4" /> {saveSuccess}
                  </div>
                )}

                {editing ? (
                  <form onSubmit={saveProfile} className="space-y-5">
                    <div>
                      <label htmlFor="customer-name" className="mb-2 block text-xs font-bold text-[#52666A]">
                        Full name
                      </label>
                      <input
                        id="customer-name"
                        value={nameDraft}
                        onChange={(event) => setNameDraft(event.target.value)}
                        maxLength={80}
                        autoComplete="name"
                        required
                        className="h-12 w-full rounded-xl border border-[#CFDCD5] bg-[#FBFCF9] px-4 text-sm text-[#102D38] outline-none transition focus:border-[#168477] focus:ring-2 focus:ring-[#168477]/10"
                        placeholder="Enter your name"
                      />
                      <p className="mt-2 text-[11px] text-[#87928B]">This is the name we'll use for your orders.</p>
                    </div>

                    <div className="rounded-xl border border-[#E5EAE4] bg-[#F8FAF6] p-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#52666A]">
                        <Phone className="size-3.5" /> Mobile number
                      </div>
                      <p className="mt-2 text-sm font-semibold text-[#102D38]">
                        {profile.phoneNumber || "Not added"}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-[#87928B]">
                        Your verified mobile number can't be changed here.
                      </p>
                    </div>

                    {saveError && (
                      <p role="alert" className="flex items-center gap-2 text-xs font-medium text-red-600">
                        <CircleAlert className="size-4 shrink-0" /> {saveError}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={saving || !nameDraft.trim()}
                        className="inline-flex h-11 items-center gap-2 rounded-full bg-[#168477] px-6 text-xs font-bold text-white transition hover:bg-[#102D38] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                        {saving ? "Saving..." : "Save changes"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        disabled={saving}
                        className="inline-flex h-11 items-center gap-2 rounded-full border border-[#D8E1DC] px-5 text-xs font-bold text-[#52666A] transition hover:bg-[#F6F8F3] disabled:opacity-50"
                      >
                        <X className="size-4" /> Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#DCECE5] font-[family-name:var(--font-manrope)] text-lg font-extrabold uppercase text-[#168477]">
                        {profile.name.trim().charAt(0) || "C"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#87928B]">Full name</p>
                        <p className="mt-1 break-words font-[family-name:var(--font-manrope)] text-lg font-extrabold text-[#102D38]">
                          {profile.name}
                        </p>
                      </div>
                    </div>

                    <div className="h-px bg-[#E9ECE5]" />

                    <div className="flex items-start gap-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F6F1] text-[#668078]">
                        <Phone className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#87928B]">Mobile number</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-[#102D38]">{profile.phoneNumber || "Not added"}</p>
                          {profile.phoneNumberVerified && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[#EAF5EF] px-2 py-1 text-[9px] font-bold text-[#168477]">
                              <BadgeCheck className="size-3" /> Verified
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-[#E9ECE5]" />

                    <div className="flex items-start gap-4">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#F3F6F1] text-[#668078]">
                        <Clock3 className="size-4" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#87928B]">Member since</p>
                        <p className="mt-1 text-sm font-bold text-[#102D38]">{memberSince}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-5">
              <section className="rounded-[28px] bg-[#102D38] p-6 text-[#F6F3EA] shadow-[0_18px_60px_rgba(16,45,56,0.12)] sm:p-7">
                <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-[#A8D2C2]">
                  <Package className="size-5" />
                </div>
                <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#A8D2C2]">Your orders</p>
                <h2 className="mt-2 font-[family-name:var(--font-manrope)] text-2xl font-extrabold tracking-tight">
                  Freshness is on its way.
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#C4D1CF]">
                  Keep an eye on your orders, check their status and revisit the details whenever you need.
                </p>
                <Link
                  href="/account/orders"
                  className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#168477] px-5 text-xs font-bold text-white transition hover:bg-[#1B9989]"
                >
                  View my orders <ArrowRight className="size-4" />
                </Link>
              </section>

              <section className="rounded-[28px] border border-[#E2E4D9] bg-white p-6 sm:p-7">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[#DCECE5] text-[#168477]">
                    <ShoppingBag className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-[family-name:var(--font-manrope)] text-base font-extrabold text-[#102D38]">Need something fresh?</h3>
                    <p className="mt-0.5 text-xs text-[#87928B]">Explore today's selection.</p>
                  </div>
                </div>
                <Link
                  href="/products"
                  className="mt-5 flex items-center justify-between border-t border-[#E9ECE5] pt-4 text-xs font-bold text-[#168477] transition hover:text-[#102D38]"
                >
                  Browse the catalogue <ChevronRight className="size-4" />
                </Link>
              </section>

              <p className="px-2 text-[11px] leading-5 text-[#8A9690]">
                Need help with your account or an order? Contact the Choperz Fresh support team.
              </p>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
}
