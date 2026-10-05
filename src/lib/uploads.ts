/**
 * Upload rules — shared by the browser (early rejection) and the server (the
 * check that counts).
 */
export const ALLOWED_UPLOADS: Record<string, { ext: string[]; kind: "image" | "pdf" | "doc" }> = {
  "image/png": { ext: ["png"], kind: "image" },
  "image/jpeg": { ext: ["jpg", "jpeg"], kind: "image" },
  "image/webp": { ext: ["webp"], kind: "image" },
  "application/pdf": { ext: ["pdf"], kind: "pdf" },
  "application/msword": { ext: ["doc"], kind: "doc" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
    ext: ["docx"],
    kind: "doc",
  },
};

export const ACCEPT_ATTR = ".png,.jpg,.jpeg,.webp,.pdf,.doc,.docx";

export const MAX_FILES_PER_SAMPLE = 10;

export function maxUploadBytes(): number {
  const mb = Number(process.env.NEXT_PUBLIC_UPLOAD_MAX_MB ?? process.env.UPLOAD_MAX_MB ?? 15);
  return (Number.isFinite(mb) && mb > 0 ? mb : 15) * 1024 * 1024;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Resolve the MIME type from extension (browsers send unreliable types for .doc). */
export function mimeFromName(name: string): string | null {
  const ext = extOf(name);
  for (const [mime, rule] of Object.entries(ALLOWED_UPLOADS)) {
    if (rule.ext.includes(ext)) return mime;
  }
  return null;
}

export function fileKind(mime: string): "image" | "pdf" | "doc" | "other" {
  return ALLOWED_UPLOADS[mime]?.kind ?? "other";
}

/** Magic-number check so a renamed .exe cannot pass as a .png. */
export function sniffMatches(mime: string, head: Uint8Array): boolean {
  const starts = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);
  switch (mime) {
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47);
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/webp":
      return starts(0x52, 0x49, 0x46, 0x46) && head[8] === 0x57 && head[9] === 0x45;
    case "application/pdf":
      return starts(0x25, 0x50, 0x44, 0x46);
    case "application/msword":
      return starts(0xd0, 0xcf, 0x11, 0xe0);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return starts(0x50, 0x4b, 0x03, 0x04);
    default:
      return false;
  }
}
