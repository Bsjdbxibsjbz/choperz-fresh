
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Drumstick, Fish } from "lucide-react";

export function CategoryShowcase() {
  return (
    <section className="bg-[#F6F3EA] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-[1280px]">

        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#168477]">
              Explore our collection
            </p>

            <h2 className="mt-4 max-w-xl font-[family-name:var(--font-manrope)] text-3xl font-extrabold tracking-[-0.055em] text-[#102D38] sm:text-4xl lg:text-5xl">
              Something fresh for every table.
            </h2>

            <p className="mt-3 text-sm leading-7 text-[#60717A]">
              Explore our seafood and chicken collections.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-2">

          {/* Seafood */}
          <Link
            href="/products?category=seafood"
            className="group relative isolate min-h-[370px] overflow-hidden rounded-[28px] bg-[#102D38] sm:min-h-[460px]"
          >
            <Image
              src="/images/storefront/fish-market.jpg"
              alt="Fresh seafood selection"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-[#081A21]/95 via-[#102D38]/30 to-transparent" />

            <div className="absolute left-7 top-7 flex items-center gap-2 rounded-full border border-white/25 bg-[#102D38]/50 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md">
              <Fish className="size-4" />
              THE COASTAL COLLECTION
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-7 sm:p-9">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8FB8A9]">
                Fresh from the ocean
              </p>

              <h3 className="mt-3 font-[family-name:var(--font-manrope)] text-4xl font-extrabold tracking-[-0.06em] text-white sm:text-5xl">
                Seafood.
              </h3>

              <p className="mt-3 max-w-sm text-sm leading-7 text-white/75">
                Discover fish, prawns and crabs for your next coastal meal.
              </p>

              <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-[#168477] px-6 py-3 text-sm font-bold text-white transition-colors group-hover:bg-[#1A9584]">
                Explore seafood
                <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </div>
          </Link>

          {/* Chicken */}
          <Link
            href="/products?category=chicken"
            className="group relative isolate flex min-h-[370px] flex-col justify-between overflow-hidden rounded-[28px] bg-[#102D38] p-7 sm:min-h-[460px] sm:p-9"
          >
            <div
              aria-hidden="true"
              className="absolute -right-16 top-10 size-80 rounded-full bg-[#168477]/20 blur-3xl transition-all duration-700 group-hover:bg-[#168477]/35"
            />

            <div
              aria-hidden="true"
              className="absolute -bottom-36 -right-20 size-96 rounded-full border border-[#8FB8A9]/20"
            />

            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold text-[#DCECE5]">
                <Drumstick className="size-4" />
                CHICKEN COLLECTION
              </div>

              <ArrowUpRight className="size-6 text-[#8FB8A9] transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
            </div>

            <div className="relative z-10 mt-8 flex flex-1 items-center justify-center">
              <div className="flex size-44 items-center justify-center rounded-full border border-[#8FB8A9]/20 bg-[#168477]/15 shadow-2xl shadow-black/20 sm:size-56">
                <div className="flex size-32 items-center justify-center rounded-full bg-[#DCECE5] text-[#102D38] transition-transform duration-500 group-hover:rotate-[-12deg] group-hover:scale-110 sm:size-40">
                  <Drumstick className="size-20 sm:size-24" strokeWidth={1.2} />
                </div>
              </div>
            </div>

            <div className="relative z-10 mt-8">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#8FB8A9]">
                Everyday favourites
              </p>

              <h3 className="mt-3 font-[family-name:var(--font-manrope)] text-4xl font-extrabold tracking-[-0.06em] text-white sm:text-5xl">
                Chicken.
              </h3>

              <p className="mt-3 max-w-sm text-sm leading-7 text-white/75">
                Explore chicken strips, wings and lollipops.
              </p>

              <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-[#F6F3EA] px-6 py-3 text-sm font-bold text-[#102D38] transition-colors group-hover:bg-[#DCECE5]">
                Explore chicken
                <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
              </div>
            </div>
          </Link>

        </div>

        {/* Quick category links */}
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <span className="mr-1 text-xs font-semibold text-[#60717A]">
            Browse:
          </span>

          {[
            { label: "Fresh Fish", href: "/products?category=fish" },
            { label: "Prawns", href: "/products?category=prawns" },
            { label: "Crabs", href: "/products?category=crab" },
            { label: "Chicken", href: "/products?category=chicken" },
          ].map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-full border border-[#D8E1DC] bg-white px-5 py-2.5 text-xs font-semibold text-[#102D38] transition-colors hover:border-[#168477] hover:text-[#168477]"
            >
              {item.label}
            </Link>
          ))}
        </div>

      </div>
    </section>
  );
}
