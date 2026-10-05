import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { can } from "@/lib/permissions";
import { currentUser } from "@/lib/session";
import { storage } from "@/lib/storage";
import { fileKind } from "@/lib/uploads";

/** Stream an attachment. ?download=1 forces a download; otherwise inline where the browser can show it. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || !can(user, "sample.view")) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;

  const att = await prisma.sampleAttachment.findUnique({ where: { id } });
  // Unlinked uploads are visible only to whoever uploaded them.
  if (!att || (!att.sampleId && att.uploadedById !== user.id)) return new NextResponse("Not found", { status: 404 });

  const data = await storage().get(att.storageKey);
  if (!data) return new NextResponse("The file is missing from storage.", { status: 410 });

  const download = new URL(req.url).searchParams.get("download") === "1";
  const inline = !download && fileKind(att.mimeType) !== "doc";
  const encoded = encodeURIComponent(att.originalName);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${att.originalName.replace(/"/g, "")}"; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=300",
    },
  });
}
