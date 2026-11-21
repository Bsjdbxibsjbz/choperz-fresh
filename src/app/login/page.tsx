
import type { Metadata } from "next";
import { Suspense } from "react";
import { CustomerAuthForm } from "@/components/storefront/customer-auth-form";

export const metadata: Metadata = {
  title: "Sign in | Choperz Fresh",
  description: "Sign in to your Choperz Fresh customer account.",
};

type LoginSearchParams = {
  callbackUrl?: string;
};

type LoginPageProps = {
  searchParams: Promise<LoginSearchParams>;
};

async function LoginContent({
  searchParams,
}: LoginPageProps) {
  const { callbackUrl } = await searchParams;

  const safeCallbackUrl =
    callbackUrl?.startsWith("/") &&
    !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/";

  return <CustomerAuthForm callbackUrl={safeCallbackUrl} />;
}

export default function LoginPage({
  searchParams,
}: LoginPageProps) {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F6F3EA]">
          <div className="text-center">
            <p className="font-[family-name:var(--font-manrope)] text-3xl font-extrabold tracking-tight text-[#102D38]">
              CHOPERZ<span className="text-[#168477]">.</span>
            </p>
            <p className="mt-3 text-sm text-[#60717A]">
              Preparing your sign-in experience...
            </p>
          </div>
        </main>
      }
    >
      <LoginContent searchParams={searchParams} />
    </Suspense>
  );
}
