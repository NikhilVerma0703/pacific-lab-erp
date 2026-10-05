/**
 * Role → permission map. The single place access rules live.
 *
 * Call sites ask `can(user, "sample.delete")`, never `role === "ADMIN"`, so a
 * rule change (or a new role, or a new module's permissions) is one edit here.
 * Safe to import on the client: it holds no secrets, and the server re-checks
 * every action anyway.
 */
export type Role = "ADMIN" | "MANAGER" | "OPERATOR" | "VIEWER";

export const ROLES: Role[] = ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  OPERATOR: "Lab Operator",
  VIEWER: "Viewer",
};

const PERMISSIONS = {
  // Samples
  "sample.view": ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"],
  "sample.create": ["ADMIN", "MANAGER", "OPERATOR"],
  "sample.edit": ["ADMIN", "MANAGER", "OPERATOR"],
  "sample.delete": ["ADMIN", "MANAGER"],
  /** Type a S.No. / Slab Number instead of taking the suggested one. */
  "sample.overrideNumbers": ["ADMIN", "MANAGER"],
  /** Back-date or forward-date a sample. Others get today's date. */
  "sample.changeDate": ["ADMIN", "MANAGER", "OPERATOR"],
  // Inward / Outward
  "inward.view": ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"],
  "inward.create": ["ADMIN", "MANAGER", "OPERATOR"],
  "inward.edit": ["ADMIN", "MANAGER", "OPERATOR"],
  "inward.delete": ["ADMIN", "MANAGER"],
  "inward.overrideNumbers": ["ADMIN", "MANAGER"],
  // Dashboard & announcements (Lab Head / Plant Head / CEO = Manager or Admin)
  "dashboard.view": ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"],
  "announcement.publish": ["ADMIN", "MANAGER"],
  // Downloads / Excel export
  "downloads.view": ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"],
  // Reports
  "reports.view": ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"],
  "attachment.upload": ["ADMIN", "MANAGER", "OPERATOR"],
  "attachment.remove": ["ADMIN", "MANAGER", "OPERATOR"],
  // Master data — the brief asks that everyone can maintain the lists.
  "master.view": ["ADMIN", "MANAGER", "OPERATOR", "VIEWER"],
  "master.manage": ["ADMIN", "MANAGER", "OPERATOR"],
  /** Add a value straight from a data-entry form ("OTHER"). */
  "master.addFromForm": ["ADMIN", "MANAGER", "OPERATOR"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(user: { role: Role } | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return (PERMISSIONS[permission] as readonly Role[]).includes(user.role);
}

/** Every permission a role holds — sent to client components as a plain list. */
export function permissionsFor(role: Role): Permission[] {
  return (Object.keys(PERMISSIONS) as Permission[]).filter((p) =>
    (PERMISSIONS[p] as readonly Role[]).includes(role),
  );
}
