import { inngest } from "./client";
import { cleanupOrphanUploads } from "@/modules/samples/cleanup";

/**
 * Nightly: remove files that were uploaded but never attached to a saved
 * sample (form abandoned, upload replaced before saving).
 */
export const orphanUploadCleanup = inngest.createFunction(
  {
    id: "orphan-upload-cleanup",
    name: "Remove abandoned sample uploads",
    triggers: [{ cron: "TZ=Asia/Kolkata 30 2 * * *" }],
  },
  async ({ step }) => {
    const removed = await step.run("delete-orphans", () => cleanupOrphanUploads());
    return { removed };
  },
);

export const functions = [orphanUploadCleanup];
