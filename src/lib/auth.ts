
import "server-only";

import { betterAuth } from "better-auth";
import { phoneNumber } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  },

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

      phoneNumberValidator: (value) =>
        /^\+[1-9]\d{7,14}$/.test(value),

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

      signUpOnVerification: {
        getTempEmail: (phoneNumber) =>
          `${phoneNumber.replace(/\D/g, "")}@phone.choperz.invalid`,

        getTempName: () => "Choperz Customer",
      },
    }),
  ],
});
