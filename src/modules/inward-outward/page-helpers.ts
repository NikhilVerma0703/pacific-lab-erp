import "server-only";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/session";

/** What the signed-in role may do in the Inward / Outward form. */
export interface InwardFormPermissions {
  overrideNumbers: boolean;
  addMaster: boolean;
  upload: boolean;
  removeFiles: boolean;
}

export function inwardFormPermissions(user: CurrentUser): InwardFormPermissions {
  return {
    overrideNumbers: can(user, "inward.overrideNumbers"),
    addMaster: can(user, "master.addFromForm"),
    upload: can(user, "attachment.upload"),
    removeFiles: can(user, "attachment.remove"),
  };
}
