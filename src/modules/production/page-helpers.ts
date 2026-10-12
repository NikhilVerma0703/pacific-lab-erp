import "server-only";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/session";

/** What the signed-in role may do in the Production Sample form. */
export interface ProductionFormPermissions {
  overrideNumbers: boolean;
  changeDate: boolean;
  addMaster: boolean;
  upload: boolean;
  removeFiles: boolean;
}

export function productionFormPermissions(user: CurrentUser): ProductionFormPermissions {
  return {
    overrideNumbers: can(user, "production.overrideNumbers"),
    changeDate: can(user, "production.changeDate"),
    addMaster: can(user, "master.addFromForm"),
    upload: can(user, "attachment.upload"),
    removeFiles: can(user, "attachment.remove"),
  };
}
