
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
export async function requireSuperAdmin(
  requiredPermissions: string[] = []
) {
  const access = await requireStaffPermissions(requiredPermissions);

  if (!access.authorized) {
    return access;
  }

  if (access.roleName !== "SUPER_ADMIN") {
    return {
      authorized: false as const,
      status: 403 as const,
      message: "Super Admin access required.",
    };
  }

  return access;
}

export async function requireDriverPermissions(
  requiredPermissions: string[]
) {
  // 1. Authenticate and verify the driver's required permissions.
  const access = await requireStaffPermissions(requiredPermissions);

  if (!access.authorized) {
    return access;
  }

  // 2. Only accounts with the DRIVER role can use driver APIs.
  if (access.roleName !== "DRIVER") {
    return {
      authorized: false as const,
      status: 403 as const,
      message: "Driver access required.",
    };
  }

  // 3. Load the driver's linked profile and verification status.
  const staffProfile = await prisma.staffProfile.findUnique({
    where: {
      userId: access.userId,
    },
    select: {
      driverProfile: {
        select: {
          id: true,
          availability: true,
        },
      },
      user: {
        select: {
          phoneNumberVerified: true,
        },
      },
    },
  });

  if (!staffProfile?.driverProfile) {
    return {
      authorized: false as const,
      status: 403 as const,
      message: "Driver profile is not configured.",
    };
  }

  if (staffProfile.user.phoneNumberVerified !== true) {
    return {
      authorized: false as const,
      status: 403 as const,
      message: "Driver mobile verification is required.",
    };
  }

  // 4. Return the authenticated driver's own profile ID.
  return {
    ...access,
    driverProfileId: staffProfile.driverProfile.id,
    availability: staffProfile.driverProfile.availability,
  };
}
