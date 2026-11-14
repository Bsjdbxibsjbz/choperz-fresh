
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is missing from your .env file.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  const terminal = createInterface({ input: stdin, output: stdout });

  try {
    console.log("\nCHOPERZ FRESH - First Super Admin Setup\n");

    const name = (await terminal.question("Administrator full name: ")).trim();
    const phoneNumber = (
      await terminal.question("Administrator mobile (+91...): ")
    ).trim();

    if (name.length < 2) {
      throw new Error("Please enter a valid administrator name.");
    }

    if (!/^\+[1-9]\d{7,14}$/.test(phoneNumber)) {
      throw new Error("Enter a valid international phone number, e.g. +919876543210.");
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingSuperAdmin = await tx.staffProfile.findFirst({
        where: {
          role: { name: "SUPER_ADMIN" },
        },
        select: { id: true },
      });

      if (existingSuperAdmin) {
        throw new Error(
          "A Super Admin already exists. Bootstrap is disabled."
        );
      }

      const existingUser = await tx.user.findUnique({
        where: { phoneNumber },
        select: { id: true },
      });

      if (existingUser) {
        throw new Error(
          "This phone number already belongs to an account. No account was changed. Review it before proceeding."
        );
      }

      const role = await tx.role.findUnique({
        where: { name: "SUPER_ADMIN" },
        select: { id: true },
      });

      if (!role) {
        throw new Error(
          "SUPER_ADMIN role not found. Run the existing database seed first."
        );
      }

      const internalEmail =
        `${phoneNumber.replace(/\D/g, "")}@phone.choperz.invalid`;

      const user = await tx.user.create({
        data: {
          id: randomUUID(),
          name,
          email: internalEmail,
          emailVerified: false,
          phoneNumber,
          phoneNumberVerified: false,
          kind: "STAFF",
        },
      });

      await tx.staffProfile.create({
        data: {
          userId: user.id,
          roleId: role.id,
          outletId: null,
          isActive: true,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: null,
          action: "BOOTSTRAP_SUPER_ADMIN",
          entity: "User",
          entityId: user.id,
          after: {
            role: "SUPER_ADMIN",
            staffProfileCreated: true,
          },
        },
      });

      return { id: user.id };
    });

    console.log("\nSUCCESS: First Super Admin created.");
    console.log(`Staff account ID: ${result.id}`);
    console.log("Mobile OTP verification is still required for login.");
    console.log("No password has been created.");
  } finally {
    terminal.close();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    "\nBootstrap failed:",
    error instanceof Error ? error.message : error
  );
  process.exitCode = 1;
});
