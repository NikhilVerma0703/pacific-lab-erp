import "server-only";
import { can } from "@/lib/permissions";
import type { CurrentUser } from "@/lib/session";
import type { SampleFormPermissions } from "./components/SampleForm";

export function formPermissions(user: CurrentUser): SampleFormPermissions {
  return {
    overrideNumbers: can(user, "sample.overrideNumbers"),
    changeDate: can(user, "sample.changeDate"),
    addMaster: can(user, "master.addFromForm"),
    upload: can(user, "attachment.upload"),
    removeFiles: can(user, "attachment.remove"),
  };
}

export function uploadLimitMb(): number {
  const mb = Number(process.env.UPLOAD_MAX_MB ?? 15);
  return Number.isFinite(mb) && mb > 0 ? mb : 15;
}
