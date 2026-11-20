
"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Fish, Sparkles } from "lucide-react";

export function HeroSection() {
  const shouldReduceMotion = useReducedMotion();

 const fadeUp = {
  initial: false,
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.3 },
  transition: { duration: 0.7, ease: "easeOut" as const },
};

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden bg-[#102D38] text-[#F6F3EA]"
    >
      {/* Decorative background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 top-20 size-[500px] rounded-full bg-[#168477]/10 blur-[120px]"
      />

      <div className="mx-auto grid min-h-[590px] max-w-[1440px] lg:min-h-[680px] lg:grid-cols-[1.02fr_0.98fr]">
        {/* Hero copy */}
        <div className="relative z-10 flex flex-col justify-center px-6 pb-12 pt-16 sm:px-10 lg:px-14 lg:py-24 xl:px-20">
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.65, delay: 0.1 }}
            className="mb-8 flex items-center gap-3"
          >
            <span className="flex size-9 items-center justify-center rounded-full border border-[#168477]/50 bg-[#168477]/15">
              <Fish className="size-[17px] text-[#7EC6B2]" />
            </span>

            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[#B1C3C2] sm:text-xs">
              Fresh from the coast
            </span>
          </motion.div>

          <motion.h1
            id="hero-heading"
            {...fadeUp}
            transition={{ duration: 0.75, delay: 0.2 }}
            className="max-w-[650px] font-[family-name:var(--font-manrope)] text-[clamp(3rem,6.5vw,5.7rem)] font-extrabold leading-[1.02] tracking-[-0.065em]"
          >
            The ocean&apos;s finest.
            <span className="mt-2 block text-[#8FB8A9]">
              At your table.
            </span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.7, delay: 0.35 }}
            className="mt-7 max-w-[440px] text-base leading-8 text-[#D0DEDA] sm:text-lg"
          >
            Discover thoughtfully selected fish, prawns and crabs.
            Your favourite coastal flavours, brought closer to home.
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="mt-9 flex flex-wrap items-center gap-4"
          >
            <Link
              href="/products"
              className="group inline-flex min-h-14 items-center gap-3 rounded-full bg-[#168477] px-7 text-sm font-bold text-white shadow-lg shadow-black/10 transition-all hover:-translate-y-1 hover:bg-[#1A9584] hover:shadow-xl"
            >
              Explore seafood
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <a
              href="#our-promise"
              className="inline-flex min-h-14 items-center gap-2 rounded-full border border-white/20 px-6 text-sm font-semibold text-[#F6F3EA] transition-colors hover:border-[#8FB8A9] hover:bg-white/5"
            >
              Discover our promise
            </a>
          </motion.div>

          {/* Small brand signature */}
          <motion.div
            {...fadeUp}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-14 flex items-center gap-3"
          >
            <div className="flex -space-x-2">
              <span className="size-2 rounded-full bg-[#168477]" />
              <span className="size-2 rounded-full bg-[#8FB8A9]" />
              <span className="size-2 rounded-full bg-[#E58B62]" />
            </div>

            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A9BEC0]">
              A fresher way to enjoy seafood
            </span>
          </motion.div>
        </div>

        {/* Hero photography */}
        <motion.div
         initial={false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.1, ease: "easeOut" }}
          className="relative min-h-[390px] overflow-hidden sm:min-h-[490px] lg:min-h-full"
        >
          <Image
            src="/images/storefront/hero-seafood.jpg"
            alt="Fresh seafood arranged for a coastal meal"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />

          {/* Atmospheric image treatment */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#102D38]/65 via-transparent to-[#102D38]/10 lg:bg-gradient-to-r lg:from-[#102D38]/30 lg:via-transparent lg:to-transparent" />

          {/* Photo caption */}
          <div className="absolute bottom-7 left-6 right-6 flex items-end justify-between gap-4 sm:bottom-10 sm:left-10 sm:right-10">
            <div className="flex items-center gap-3 rounded-2xl border border-white/20 bg-[#102D38]/55 p-4 text-white shadow-xl backdrop-blur-xl">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#168477]">
                <Sparkles className="size-5" />
              </span>

              <div>
                <p className="text-sm font-bold">Selected with care</p>
                <p className="mt-1 text-[11px] text-white/75">
                  Every detail matters
                </p>
              </div>
            </div>

            <span className="hidden text-[10px] font-medium uppercase tracking-[0.2em] text-white/75 sm:block">
              CHOPERZ FRESH · EST. 2026
            </span>
          </div>
        </motion.div>
      </div>

      {/* Bottom accent line */}
      <div className="h-1 w-full bg-gradient-to-r from-[#102D38] via-[#168477] to-[#E58B62]" />
    </section>
  );
}
