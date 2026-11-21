
import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireCustomer() {
  // Check the current Better Auth session.
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return {
      authorized: false,
      status: 401,
      message: "Please log in with your mobile number.",
    } as const;
  }

  // Verify the account directly against the database.
  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      kind: true,
      phoneNumber: true,
      phoneNumberVerified: true,
    },
  });

  // Only verified customer accounts may use customer APIs.
  if (
    !user ||
    user.kind !== "CUSTOMER" ||
    !user.phoneNumber ||
    user.phoneNumberVerified !== true
  ) {
    return {
      authorized: false,
      status: 403,
      message: "A verified customer account is required.",
    } as const;
  }

  return {
    authorized: true,
    userId: user.id,
    phoneNumber: user.phoneNumber,
  } as const;
}
