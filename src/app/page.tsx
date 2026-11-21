import { CategoryShowcase } from "@/components/storefront/category-showcase";
import { ProductShowcase } from "@/components/storefront/product-showcase";
import Link from "next/link";
import {
  ArrowRight,
  Fish,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";

import { SmoothScroll } from "@/components/storefront/smooth-scroll";
import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { HeroSection } from "@/components/storefront/hero-section";

const promises = [
  {
    icon: Fish,
    title: "Thoughtfully selected",
    description:
      "A considered selection of seafood for everyday coastal cooking.",
  },
  {
    icon: ShieldCheck,
    title: "Quality matters",
    description:
      "Clear product information and care at every step.",
  },
  {
    icon: Truck,
    title: "Convenience, made fresh",
    description:
      "A simpler way to bring your seafood favourites home.",
  },
];

export default function Home() {
  return (
    <SmoothScroll>
      <StorefrontHeader />

      <main>
        <HeroSection />
        <CategoryShowcase />
        <ProductShowcase />

        {/* Brand promise */}
        <section
          id="our-promise"
          className="bg-[#F6F3EA] px-5 py-20 sm:px-8 lg:px-12 lg:py-28"
        >
          <div className="mx-auto max-w-[1280px]">
            <div className="mx-auto max-w-2xl text-center">
              <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#168477]">
                <Sparkles className="size-3.5" />
                The Choperz promise
              </span>

              <h2 className="mt-5 font-[family-name:var(--font-manrope)] text-3xl font-extrabold tracking-[-0.055em] text-[#102D38] sm:text-4xl lg:text-5xl">
                Good seafood deserves
                <span className="block text-[#168477]">
                  a little more care.
                </span>
              </h2>

              <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-[#60717A] sm:text-base">
                From choosing your favourites to getting them ready for
                your kitchen, we want every part of the experience to
                feel considered.
              </p>
            </div>

            <div className="mt-14 grid gap-4 md:grid-cols-3 lg:gap-6">
              {promises.map((promise, index) => {
                const Icon = promise.icon;

                return (
                  <article
                    key={promise.title}
                    className="group rounded-2xl border border-[#D8E1DC] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-[#168477]/40 hover:shadow-xl hover:shadow-[#102D38]/5 lg:p-9"
                  >
                    <div className="flex size-12 items-center justify-center rounded-xl bg-[#DCECE5] text-[#168477] transition-colors group-hover:bg-[#168477] group-hover:text-white">
                      <Icon className="size-5" strokeWidth={1.8} />
                    </div>

                    <span className="mt-8 block text-[10px] font-bold tracking-[0.2em] text-[#8A9998]">
                      0{index + 1}
                    </span>

                    <h3 className="mt-2 font-[family-name:var(--font-manrope)] text-xl font-bold tracking-tight text-[#102D38]">
                      {promise.title}
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-[#60717A]">
                      {promise.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* Editorial call to action */}
        <section className="overflow-hidden bg-white px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-8 rounded-[28px] bg-[#DCECE5] p-8 sm:p-12 lg:flex-row lg:items-center lg:p-16">
            <div className="max-w-2xl">
              <span className="text-[10px] font-bold uppercase tracking-[0.23em] text-[#168477]">
                Your next coastal meal starts here
              </span>

              <h2 className="mt-4 font-[family-name:var(--font-manrope)] text-3xl font-extrabold tracking-[-0.055em] text-[#102D38] sm:text-4xl">
                Make room for something fresh.
              </h2>

              <p className="mt-4 max-w-lg text-sm leading-7 text-[#50636A]">
                Explore the Choperz Fresh seafood collection and find
                something delicious for your table.
              </p>
            </div>

            <Link
              href="/products"
              className="group inline-flex min-h-13 shrink-0 items-center gap-3 rounded-full bg-[#102D38] px-7 text-sm font-semibold text-white transition-all hover:bg-[#168477]"
            >
              Explore the collection
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#102D38] px-5 pb-8 pt-16 text-[#F6F3EA] sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1280px]">
          <div className="grid gap-12 border-b border-white/15 pb-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <Link href="/" className="inline-block">
                <span className="font-[family-name:var(--font-manrope)] text-3xl font-extrabold tracking-[-0.075em]">
                  CHOPERZ<span className="text-[#168477]">.</span>
                </span>
              </Link>

              <p className="mt-4 max-w-sm text-sm leading-7 text-[#B1C3C2]">
                A fresher way to bring the coast home. Discover
                thoughtfully selected seafood for your table.
              </p>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#8FB8A9]">
                Explore
              </h3>

              <nav className="mt-5 flex flex-col items-start gap-3 text-sm text-[#D0DEDA]">
                <Link href="/products" className="transition-colors hover:text-white">
                  All seafood
                </Link>
                <Link href="/products?category=fish" className="transition-colors hover:text-white">
                  Fresh fish
                </Link>
                <Link href="/products?category=prawns" className="transition-colors hover:text-white">
                  Prawns
                </Link>
                <Link href="/products?category=crab" className="transition-colors hover:text-white">
                  Crabs
                </Link>
              </nav>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-[#8FB8A9]">
                Your account
              </h3>

              <nav className="mt-5 flex flex-col items-start gap-3 text-sm text-[#D0DEDA]">
                <Link href="/account" className="transition-colors hover:text-white">
                  My account
                </Link>
                <Link href="/orders" className="transition-colors hover:text-white">
                  Track orders
                </Link>
                <Link href="/cart" className="transition-colors hover:text-white">
                  Shopping cart
                </Link>
              </nav>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-7 text-xs text-[#A9BEC0] sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Choperz Fresh. All rights reserved.</p>
            <p>Fresh from the coast, with care.</p>
          </div>
        </div>
      </footer>
    </SmoothScroll>
  );
}
