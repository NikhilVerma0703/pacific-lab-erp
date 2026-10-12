import "server-only";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/session";

/** What the signed-in role may do in the Lab Sample form. */
export interface LabFormPermissions {
  overrideNumbers: boolean;
  changeDate: boolean;
  addMaster: boolean;
  upload: boolean;
  removeFiles: boolean;
}

export function labFormPermissions(user: CurrentUser): LabFormPermissions {
  return {
    overrideNumbers: can(user, "sample.overrideNumbers"),
    changeDate: can(user, "sample.changeDate"),
    addMaster: can(user, "master.addFromForm"),
    upload: can(user, "attachment.upload"),
    removeFiles: can(user, "attachment.remove"),
  };
}
