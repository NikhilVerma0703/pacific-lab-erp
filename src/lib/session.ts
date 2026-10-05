import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { can, type Permission, type Role } from "@/lib/permissions";

/**
 * No sign-in for now.
 *
 * Everyone works as one built-in user (an Admin), so every screen and action is
 * available. The user is a real row in the User table because records keep
 * "created by" / "updated by" — so history stays attributed, and nothing in
 * the data model changes when sign-in returns.
 *
 * TO BRING SIGN-IN BACK: replace `currentUser()` below with a session lookup
 * (Auth.js v5 credentials, as before). Every page, action and API route reads
 * the user only through this file, and every permission check already goes
 * through `can()` — nothing else has to change.
 */
export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

const LOCAL_EMAIL = () => (process.env.SEED_ADMIN_EMAIL ?? "admin@pacific-surfaces.com").toLowerCase();
const LOCAL_NAME = () => process.env.SEED_ADMIN_NAME ?? "Lab Admin";

/** The built-in local user, created on first use. Once per request. */
export const currentUser = cache(async (): Promise<CurrentUser> => {
  const email = LOCAL_EMAIL();
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    try {
      user = await prisma.user.create({
        data: { email, name: LOCAL_NAME(), role: "ADMIN", passwordHash: "!local-mode-no-password" },
      });
    } catch (e) {
      // Two requests created it at the same moment.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        user = await prisma.user.findUniqueOrThrow({ where: { email } });
      } else throw e;
    }
  }
  return { id: user.id, name: user.name, email: user.email, role: user.role };
});

/** Kept so pages read the same way they will when sign-in returns. */
export async function requireUser(): Promise<CurrentUser> {
  return currentUser();
}

export class PermissionError extends Error {
  constructor(public permission: Permission) {
    super("You do not have permission to do this.");
  }
}

/** For actions: the user, or throw if the role lacks the permission. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await currentUser();
  if (!can(user, permission)) throw new PermissionError(permission);
  return user;
}
