import "server-only";

import { betterAuth } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

const defaultDevelopmentOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function isPrivateDevelopmentIPv4(hostname: string) {
  const octets = hostname.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }

  const [first, second] = octets;

  return (
    first === 10 ||
    (first === 192 && second === 168) ||
    (first === 172 && second >= 16 && second <= 31)
  );
}

export const auth = betterAuth({
  // In development, trust localhost and the current private LAN address.
  // The network IP can change, so validate incoming local origins per request.
  // Production never accepts arbitrary private-network origins.
  trustedOrigins:
    process.env.NODE_ENV === "development"
      ? async (request) => {
          if (!request) return defaultDevelopmentOrigins;

          const origin = request.headers.get("origin");
          if (!origin) return defaultDevelopmentOrigins;

          try {
            const parsedOrigin = new URL(origin);
            const isLocalhost =
              parsedOrigin.hostname === "localhost" ||
              parsedOrigin.hostname === "127.0.0.1";
            const isPrivateLan =
              isPrivateDevelopmentIPv4(parsedOrigin.hostname);

            if (
              parsedOrigin.protocol === "http:" &&
              parsedOrigin.port === "3000" &&
              (isLocalhost || isPrivateLan)
            ) {
              return [...defaultDevelopmentOrigins, parsedOrigin.origin];
            }
          } catch {
            // Invalid Origin headers are not added to the allowlist.
          }

          return defaultDevelopmentOrigins;
        }
      : undefined,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Customer accounts default to CUSTOMER.
  // Users cannot choose their own account type during registration.
  user: {
    additionalFields: {
      kind: {
        type: ["CUSTOMER", "STAFF"],
        required: false,
        defaultValue: "CUSTOMER",
        input: false,
      },
    },
  },

  plugins: [
    phoneNumber({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 3,

      // Accept phone numbers in international E.164 format.
      // Example: +919876543210
      phoneNumberValidator: (value) =>
        /^\+[1-9]\d{7,14}$/.test(value),

      // Development-only OTP delivery.
      // A real SMS provider must be configured before production.
      sendOTP: ({ phoneNumber, code }) => {
        if (process.env.NODE_ENV !== "development") {
          throw new Error(
            "SMS provider is not configured. Real OTP delivery must be configured before production."
          );
        }

        console.info(
          `[CHOPERZ DEV OTP] ${phoneNumber}: ${code}`
        );
      },

      // Better Auth requires a temporary email for new
      // phone-based accounts. Customers never enter this.
      signUpOnVerification: {
        getTempEmail: (phoneNumber) =>
          `${phoneNumber.replace(/\D/g, "")}@phone.choperz.invalid`,

        getTempName: () => "Choperz Customer",
      },
    }),
  ],
});
