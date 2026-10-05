import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { currentUser } from "@/lib/session";
import { storage } from "@/lib/storage";
import { ALLOWED_UPLOADS, extOf, maxUploadBytes, mimeFromName, sniffMatches } from "@/lib/uploads";

/**
 * Upload one file for a sample. The file is stored straight away and returned
 * as an unlinked attachment; saving the sample links it. Unlinked uploads are
 * removed by the cleanup job.
 *
 * FormData: file, sampleId? (when editing), existing? (ids already on the form,
 * comma-separated — for duplicate detection before the sample is saved)
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (!can(user, "attachment.upload")) {
    return NextResponse.json({ error: "You do not have permission to upload files." }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "The upload was interrupted. Please try again." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });

  const name = file.name.replace(/[\\/]/g, "_").slice(0, 200) || "file";
  const mime = mimeFromName(name);
  if (!mime) {
    return NextResponse.json(
      { error: `“${name}” is not an allowed type. Use PNG, JPG, WEBP, PDF, DOC or DOCX.` },
      { status: 415 },
    );
  }
  const limit = maxUploadBytes();
  if (file.size === 0) return NextResponse.json({ error: `“${name}” is empty.` }, { status: 400 });
  if (file.size > limit) {
    return NextResponse.json(
      { error: `“${name}” is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${limit / 1024 / 1024} MB.` },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniffMatches(mime, buf.subarray(0, 16))) {
    return NextResponse.json(
      { error: `“${name}” does not look like a real .${extOf(name)} file.` },
      { status: 415 },
    );
  }
  const sha256 = createHash("sha256").update(buf).digest("hex");

  // Duplicate check: same bytes already on this sample / this form.
  const sampleId = (form.get("sampleId") as string | null) || null;
  const existingIds = String(form.get("existing") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const dup = await prisma.sampleAttachment.findFirst({
    where: {
      sha256,
      OR: [...(sampleId ? [{ sampleId }] : []), ...(existingIds.length ? [{ id: { in: existingIds } }] : [])],
    },
    select: { originalName: true },
  });
  if (dup && (sampleId || existingIds.length)) {
    return NextResponse.json(
      { error: `This file is already attached${dup.originalName !== name ? ` as “${dup.originalName}”` : ""}.` },
      { status: 409 },
    );
  }

  const now = new Date();
  const ext = ALLOWED_UPLOADS[mime].ext[0];
  const key = `samples/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${ext}`;

  try {
    await storage().put(key, buf, mime);
  } catch (e) {
    console.error("upload put", e);
    return NextResponse.json({ error: "The file could not be stored. Please try again." }, { status: 500 });
  }

  const att = await prisma.sampleAttachment.create({
    data: { originalName: name, storageKey: key, mimeType: mime, sizeBytes: buf.length, sha256, uploadedById: user.id },
  });

  return NextResponse.json({
    id: att.id,
    originalName: att.originalName,
    mimeType: att.mimeType,
    sizeBytes: att.sizeBytes,
    createdAt: att.createdAt.toISOString(),
  });
}
