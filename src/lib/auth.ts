
import "server-only";

import { betterAuth } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

export const auth = betterAuth({
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
