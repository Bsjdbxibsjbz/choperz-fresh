
import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function requireStaffPermissions(
  requiredPermissions: string[]
) {
  // 1. Verify the current Better Auth session.
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return {
      authorized: false as const,
      status: 401 as const,
      message: "Authentication required.",
    };
  }

  // 2. Only STAFF accounts may access staff APIs.
  if (session.user.kind !== "STAFF") {
    return {
      authorized: false as const,
      status: 403 as const,
      message: "Staff access required.",
    };
  }

  // 3. Load the active staff profile and its permissions.
  const staffProfile = await prisma.staffProfile.findUnique({
    where: {
      userId: session.user.id,
    },
    include: {
      role: {
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!staffProfile || !staffProfile.isActive) {
    return {
      authorized: false as const,
      status: 403 as const,
      message: "Staff account is inactive or not configured.",
    };
  }

  // 4. Check the permissions assigned to the staff member.
  const permissionKeys = staffProfile.role.permissions.map(
    (item) => item.permission.key
  );

  const hasAllPermissions = requiredPermissions.every(
    (permission) => permissionKeys.includes(permission)
  );

  if (!hasAllPermissions) {
    return {
      authorized: false as const,
      status: 403 as const,
      message: "You do not have permission to perform this action.",
    };
  }

  // 5. Return verified staff information.
  return {
    authorized: true as const,
    userId: session.user.id,
    roleName: staffProfile.role.name,
    outletId: staffProfile.outletId,
    permissions: permissionKeys,
  };
}
