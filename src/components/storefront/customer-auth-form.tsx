"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  ShieldCheck,
  Phone,
} from "lucide-react";

import { authClient } from "@/lib/auth-client";

type CustomerAuthFormProps = {
  callbackUrl: string;
};

export function CustomerAuthForm({
  callbackUrl,
}: CustomerAuthFormProps) {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Keep only digits and limit the phone number to 10 digits.
  const cleanPhone = phone.replace(/\D/g, "").slice(0, 10);

  const fullPhone = `+91${cleanPhone}`;

  const isPhoneValid = /^\d{10}$/.test(cleanPhone);
  const isOtpValid = /^\d{6}$/.test(otp);

  // Send OTP
  async function requestOtp() {
    if (!isPhoneValid || loading) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const result = await authClient.phoneNumber.sendOtp({
        phoneNumber: fullPhone,
      });

      if (result.error) {
        setError(
          result.error.message || "Unable to send OTP. Please try again."
        );
        return;
      }

      setStep("otp");
      setNotice(`A verification code has been requested for ${fullPhone}.`);
    } catch (err) {
      console.error("OTP request failed:", err);
      setError("Something went wrong while requesting your OTP.");
    } finally {
      setLoading(false);
    }
  }

  // Phone form submission
  async function handleSendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestOtp();
  }

  // Verify OTP
  async function handleVerifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isOtpValid || loading) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const result = await authClient.phoneNumber.verify({
        phoneNumber: fullPhone,
        code: otp,
        disableSession: false,
      });

      if (result.error) {
        setError(
          result.error.message || "Invalid OTP. Please try again."
        );
        return;
      }

      // Confirm that the server-issued session is readable before navigating.
      const sessionResult = await authClient.getSession();
      if (sessionResult.error || !sessionResult.data) {
        setError(
          "Your number was verified, but we couldn't establish your login session. Please try again."
        );
        return;
      }

      router.replace(callbackUrl);
      router.refresh();
    } catch (err) {
      console.error("OTP verification failed:", err);
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function changePhoneNumber() {
    setStep("phone");
    setOtp("");
    setError(null);
    setNotice(null);
  }

  return (
    <main className="grid min-h-screen bg-[#F6F3EA] lg:grid-cols-2">

      {/* LEFT BRAND PANEL - DESKTOP */}
      <section className="relative hidden min-h-screen overflow-hidden bg-[#102D38] p-12 text-white lg:flex lg:flex-col lg:justify-between">

        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#168477]/20 blur-3xl" />

        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#168477]">
              <span className="text-xl font-bold">C</span>
            </div>

            <span className="text-xl font-bold tracking-wide">
              CHOPERZ FRESH
            </span>
          </Link>
        </div>

        <div className="relative z-10 max-w-lg">
          <div className="mb-6 flex items-center gap-2 text-sm font-medium uppercase tracking-[0.2em] text-[#8AC8B7]">
            <ShieldCheck className="h-5 w-5" />
            Freshness you can trust
          </div>

          <h1 className="text-5xl font-bold leading-tight">
            Fresh from the coast.
            <span className="block text-[#70BBA9]">
              Delivered to your door.
            </span>
          </h1>

          <p className="mt-6 max-w-md text-lg leading-8 text-white/70">
            Sign in to explore fresh seafood, track your orders,
            and enjoy a better way to shop.
          </p>
        </div>

        <div className="relative z-10 text-sm text-white/50">
          © 2026 Choperz Fresh. All rights reserved.
        </div>
      </section>

      {/* RIGHT AUTHENTICATION PANEL */}
      <section className="flex min-h-screen flex-col items-center justify-center px-5 py-12 sm:px-10">

        {/* MOBILE BRAND */}
        <div className="mb-12 w-full max-w-md lg:hidden">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#168477] text-white">
              <span className="text-lg font-bold">C</span>
            </div>

            <span className="text-lg font-bold tracking-wide text-[#102D38]">
              CHOPERZ FRESH
            </span>
          </Link>
        </div>

        <div className="w-full max-w-md">

          {/* PHONE NUMBER STEP */}
          {step === "phone" ? (
            <div>
              <div className="mb-8">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#DCECE5] text-[#168477]">
                  <Phone className="h-6 w-6" />
                </div>

                <h2 className="text-3xl font-bold tracking-tight text-[#102D38]">
                  Welcome back
                </h2>

                <p className="mt-3 text-sm leading-6 text-[#64746F]">
                  Enter your mobile number. We&apos;ll send you a
                  one-time password to verify your account.
                </p>
              </div>

              <form onSubmit={handleSendOtp} className="space-y-5">

                <div>
                  <label
                    htmlFor="phone"
                    className="mb-2 block text-sm font-semibold text-[#102D38]"
                  >
                    Mobile number
                  </label>

                  <div className="flex overflow-hidden rounded-xl border border-[#D7DFD9] bg-white transition focus-within:border-[#168477] focus-within:ring-2 focus-within:ring-[#168477]/15">

                    <div className="flex items-center border-r border-[#D7DFD9] px-4 text-sm font-semibold text-[#102D38]">
                      +91
                    </div>

                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      maxLength={10}
                      value={phone}
                      onChange={(event) => {
                    const digits = event.currentTarget.value
                     .replace(/\D/g, "")
                         .slice(0, 10);

                         setPhone(digits);
                         setError(null);
                        }}

                      placeholder="Enter 10-digit number"
                      className="h-14 w-full bg-transparent px-4 text-base text-[#102D38] outline-none placeholder:text-[#A0AAA4]"
                    />
                  </div>

                  {/* TEMPORARY DEBUG COUNTER */}

                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!isPhoneValid || loading}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#168477] px-6 font-semibold text-white transition hover:bg-[#126E63] disabled:cursor-not-allowed disabled:bg-[#AABCB6] disabled:text-white/80"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      Continue with phone
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          ) : (

            /* OTP VERIFICATION STEP */
            <div>
              <button
                type="button"
                onClick={changePhoneNumber}
                className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-[#64746F] transition hover:text-[#168477]"
              >
                <ArrowLeft className="h-4 w-4" />
                Change phone number
              </button>

              <div className="mb-8">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#DCECE5] text-[#168477]">
                  <ShieldCheck className="h-6 w-6" />
                </div>

                <h2 className="text-3xl font-bold tracking-tight text-[#102D38]">
                  Verify your number
                </h2>

                <p className="mt-3 text-sm leading-6 text-[#64746F]">
                  Enter the six-digit verification code for{" "}
                  <span className="font-semibold text-[#102D38]">
                    {fullPhone}
                  </span>
                  .
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-5">

                <div>
                  <label
                    htmlFor="otp"
                    className="mb-2 block text-sm font-semibold text-[#102D38]"
                  >
                    Verification code
                  </label>

                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={otp}
                    onChange={(event) => {
                      setOtp(
                        event.target.value
                          .replace(/\D/g, "")
                          .slice(0, 6)
                      );
                      setError(null);
                    }}
                    placeholder="000000"
                    className="h-16 w-full rounded-xl border border-[#D7DFD9] bg-white px-4 text-center text-2xl font-bold tracking-[0.5em] text-[#102D38] outline-none transition placeholder:text-[#C3CCC5] focus:border-[#168477] focus:ring-2 focus:ring-[#168477]/15"
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600"
                  >
                    {error}
                  </p>
                )}

                {notice && (
                  <p
                    aria-live="polite"
                    className="rounded-lg bg-[#DCECE5] px-4 py-3 text-sm text-[#126E63]"
                  >
                    {notice}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={!isOtpValid || loading}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#168477] px-6 font-semibold text-white transition hover:bg-[#126E63] disabled:cursor-not-allowed disabled:bg-[#AABCB6]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      Verify and continue
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={requestOtp}
                  className="w-full py-3 text-sm font-semibold text-[#168477] transition hover:text-[#102D38] disabled:opacity-50"
                >
                  Resend verification code
                </button>
              </form>
            </div>
          )}

          <div className="mt-10 border-t border-[#E1E5DE] pt-6 text-center">
            <p className="text-xs leading-6 text-[#87928B]">
              By continuing, you agree to our Terms of Service
              and Privacy Policy.
            </p>

            <Link
              href="/"
              className="mt-5 inline-block text-sm font-medium text-[#168477] transition hover:text-[#102D38]"
            >
              Back to Choperz Fresh
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
