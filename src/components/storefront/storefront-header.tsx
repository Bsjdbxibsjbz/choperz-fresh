
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Menu,
  LogOut,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";

const navigation = [
  { label: "Shop All", href: "/products" },
  { label: "Seafood", href: "/products?category=seafood" },
  { label: "Fresh Fish", href: "/products?category=fish" },
  { label: "Prawns", href: "/products?category=prawns" },
  { label: "Crabs", href: "/products?category=crab" },
  { label: "Chicken", href: "/products?category=chicken" },
];

export function StorefrontHeader() {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  const isGuest = !sessionPending && !session?.user;
  const accountHref = sessionPending
    ? "/account"
    : session?.user.kind === "STAFF"
      ? "/admin"
      : session?.user
        ? "/account"
        : "/login";
  const accountLabel = sessionPending
    ? "Account"
    : session?.user.kind === "STAFF"
      ? "Dashboard"
      : session?.user
        ? "Account"
        : "Sign in";
  const accountActionClassName = isGuest
    ? "inline-flex h-11 items-center gap-2 rounded-full bg-[#168477] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#102D38]"
    : "flex items-center gap-2 text-sm font-medium text-[#102D38] transition-colors hover:text-[#168477]";

  async function handleSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    setSignOutError("");

    try {
      const result = await authClient.signOut();
      if (result.error) {
        throw new Error(result.error.message || "Unable to sign out. Please try again.");
      }

      setMobileMenuOpen(false);
      router.replace("/");
      router.refresh();
    } catch (error) {
      console.error("Customer sign-out failed:", error);
      setSignOutError(
        error instanceof Error ? error.message : "Unable to sign out. Please try again."
      );
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="relative z-50 w-full">
      {/* Announcement strip */}
      <div className="bg-[#102D38] px-4 py-2.5 text-center text-xs tracking-[0.12em] text-[#F6F3EA] sm:text-sm">
        <span className="font-medium">
          A FRESHER WAY TO ENJOY THE COAST
        </span>
        <span className="mx-2 hidden text-[#8FB8A9] sm:inline">•</span>
        <span className="hidden text-[#DCECE5] sm:inline">
          Quality seafood, carefully selected
        </span>
      </div>

      {/* Main navigation */}
      <div className="border-b border-[#D8E1DC] bg-[#F6F3EA]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between gap-5 px-5 sm:px-8 lg:px-12">
          {/* Brand */}
          <Link
            href="/"
            className="group flex shrink-0 flex-col leading-none"
            aria-label="Choperz Fresh home"
          >
            <span className="font-[family-name:var(--font-manrope)] text-[25px] font-extrabold tracking-[-0.075em] text-[#102D38]">
              CHOPERZ<span className="text-[#168477]">.</span>
            </span>
            <span className="mt-1 text-[8px] font-semibold tracking-[0.28em] text-[#60717A]">
              FRESH SEAFOOD MARKET
            </span>
          </Link>

          {/* Desktop search */}
          <form
            action="/products"
            method="GET"
            className="hidden max-w-[370px] flex-1 items-center rounded-full border border-[#D8E1DC] bg-white px-4 transition-all focus-within:border-[#168477] focus-within:ring-2 focus-within:ring-[#168477]/10 md:flex"
          >
            <Search className="size-[17px] shrink-0 text-[#60717A]" />
            <input
              name="q"
              type="search"
              placeholder="Search fish, prawns, crabs..."
              className="h-11 w-full bg-transparent pl-3 text-sm text-[#102D38] outline-none placeholder:text-[#8A9998]"
              aria-label="Search seafood"
            />
            <button
              type="submit"
              className="text-xs font-semibold text-[#168477] transition-colors hover:text-[#102D38]"
            >
              SEARCH
            </button>
          </form>

          {/* Desktop actions */}
          <div className="hidden shrink-0 items-center gap-5 md:flex">
            <Link
              href={accountHref}
              className={accountActionClassName}
            >
              <UserRound className="size-[19px]" strokeWidth={1.7} />
              <span>{accountLabel}</span>
            </Link>

            {!sessionPending && session?.user && (
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className="inline-flex items-center gap-2 text-sm font-medium text-[#60717A] transition-colors hover:text-[#B84C3A] disabled:cursor-wait disabled:opacity-50"
              >
                <LogOut className="size-[17px]" />
                <span>{signingOut ? "Signing out…" : "Sign out"}</span>
              </button>
            )}

            <Link
              href="/cart"
              className="group relative flex items-center gap-2 rounded-full bg-[#102D38] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[#168477]"
            >
              <ShoppingBag className="size-[17px]" strokeWidth={1.8} />
              <span>Your cart</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full border border-[#D8E1DC] text-[#102D38] transition-colors hover:bg-[#DCECE5] md:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-store-navigation"
          >
            {mobileMenuOpen ? (
              <X className="size-5" />
            ) : (
              <Menu className="size-5" />
            )}
          </button>
        </div>

        {/* Desktop category links */}
        <nav
          aria-label="Main navigation"
          className="mx-auto hidden h-12 max-w-[1440px] items-center justify-center gap-10 px-8 md:flex"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="relative text-[12px] font-semibold tracking-[0.09em] text-[#50636A] transition-colors hover:text-[#168477]"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Mobile navigation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              id="mobile-store-navigation"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden border-t border-[#D8E1DC] bg-[#F6F3EA] md:hidden"
            >
              <nav
                aria-label="Mobile navigation"
                className="flex flex-col px-6 py-4"
              >
                {navigation.map((item, index) => (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.045 }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center justify-between border-b border-[#D8E1DC] py-4 font-[family-name:var(--font-manrope)] text-base font-semibold text-[#102D38]"
                    >
                      {item.label}
                      <ArrowRight className="size-4 text-[#168477]" />
                    </Link>
                  </motion.div>
                ))}

                <form
                  action="/products"
                  method="GET"
                  className="mt-5 flex items-center gap-2 rounded-full border border-[#D8E1DC] bg-white px-4"
                >
                  <Search className="size-4 text-[#60717A]" />
                  <input
                    name="q"
                    placeholder="Find your favourite seafood..."
                    className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Search"
                    className="text-[#168477]"
                  >
                    <ArrowRight className="size-4" />
                  </button>
                </form>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-4 py-5">
                  <Link
                    href={accountHref}
                    onClick={() => setMobileMenuOpen(false)}
                    className={
                      isGuest
                        ? "inline-flex items-center gap-2 rounded-full bg-[#168477] px-4 py-2.5 text-sm font-semibold text-white"
                        : "flex items-center gap-2 text-sm font-medium text-[#102D38]"
                    }
                  >
                    <UserRound className="size-4" />
                    {accountLabel}
                  </Link>
                  <Link
                    href="/cart"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-sm font-medium text-[#102D38]"
                  >
                    <ShoppingBag className="size-4" />
                    Your cart
                  </Link>
                  {!sessionPending && session?.user && (
                    <button
                      type="button"
                      onClick={() => void handleSignOut()}
                      disabled={signingOut}
                      className="flex items-center gap-2 text-sm font-medium text-[#A24E3E] disabled:opacity-50"
                    >
                      <LogOut className="size-4" />
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  )}
                </div>
                {signOutError && (
                  <p role="alert" className="pb-4 text-xs font-medium text-[#A24E3E]">
                    {signOutError}
                  </p>
                )}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
