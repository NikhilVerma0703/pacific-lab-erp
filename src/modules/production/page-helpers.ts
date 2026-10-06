import "server-only";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/session";
import type { ProductionFormPermissions } from "./components/ProductionForm";

export function productionFormPermissions(user: CurrentUser): ProductionFormPermissions {
  return {
    overrideNumbers: can(user, "production.overrideNumbers"),
    changeDate: can(user, "production.changeDate"),
    addMaster: can(user, "master.addFromForm"),
    upload: can(user, "attachment.upload"),
    removeFiles: can(user, "attachment.remove"),
  };
}
