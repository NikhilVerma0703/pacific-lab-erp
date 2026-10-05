"use client";

import { Download, Eye, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ACCEPT_ATTR, MAX_FILES_PER_SAMPLE, extOf, fileKind, mimeFromName } from "@/lib/uploads";
import { cn, formatBytes } from "@/lib/utils";
import type { AttachmentDTO } from "../queries";
import { FileViewer, fileUrl, type ViewableFile } from "./FileViewer";

/**
 * Sample Output photo / document upload. Files upload as soon as they are
 * picked (with progress and per-file errors); the list of ids is what the form
 * saves.
 */
export function AttachmentsField({
  files,
  onChange,
  sampleId,
  canUpload,
  canRemove,
  maxMb,
}: {
  files: AttachmentDTO[];
  onChange: (files: AttachmentDTO[]) => void;
  sampleId?: string;
  canUpload: boolean;
  canRemove: boolean;
  maxMb: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ name: string; progress: number }[]>([]);
  const [viewing, setViewing] = useState<ViewableFile | null>(null);
  const [drag, setDrag] = useState(false);
  const filesRef = useRef(files);
  filesRef.current = files;

  function uploadOne(file: File): Promise<AttachmentDTO | null> {
    return new Promise((resolve) => {
      const fd = new FormData();
      fd.append("file", file);
      if (sampleId) fd.append("sampleId", sampleId);
      fd.append("existing", filesRef.current.map((f) => f.id).join(","));
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/uploads");
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        setUploading((u) => u.map((x) => (x.name === file.name ? { ...x, progress: e.loaded / e.total } : x)));
      };
      xhr.onload = () => {
        let body: { error?: string } & Partial<AttachmentDTO> = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          /* non-JSON error page */
        }
        if (xhr.status >= 200 && xhr.status < 300 && body.id) resolve(body as AttachmentDTO);
        else {
          toast.error(body.error ?? `Upload of “${file.name}” failed (${xhr.status}).`);
          resolve(null);
        }
      };
      xhr.onerror = () => {
        toast.error(`Upload of “${file.name}” failed — check the connection.`);
        resolve(null);
      };
      xhr.send(fd);
    });
  }

  async function handle(list: FileList | File[]) {
    const picked = Array.from(list);
    const room = MAX_FILES_PER_SAMPLE - files.length;
    if (picked.length > room) toast.error(`At most ${MAX_FILES_PER_SAMPLE} files per sample.`);
    const accepted: File[] = [];
    for (const f of picked.slice(0, Math.max(0, room))) {
      if (!mimeFromName(f.name)) {
        toast.error(`“${f.name}”: .${extOf(f.name) || "?"} files are not allowed. Use PNG, JPG, WEBP, PDF, DOC or DOCX.`);
      } else if (f.size > maxMb * 1024 * 1024) {
        toast.error(`“${f.name}” is larger than ${maxMb} MB.`);
      } else if (f.size === 0) {
        toast.error(`“${f.name}” is empty.`);
      } else if (accepted.some((a) => a.name === f.name && a.size === f.size)) {
        toast.error(`“${f.name}” was picked twice.`);
      } else accepted.push(f);
    }
    if (!accepted.length) return;
    setUploading((u) => [...u, ...accepted.map((f) => ({ name: f.name, progress: 0 }))]);
    for (const f of accepted) {
      const res = await uploadOne(f);
      setUploading((u) => u.filter((x) => x.name !== f.name));
      if (res) {
        onChange([...filesRef.current, res]);
        toast.success(`Uploaded “${res.originalName}”.`);
      }
    }
  }

  return (
    <div className="space-y-3">
      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (e.dataTransfer.files.length) handle(e.dataTransfer.files);
          }}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center",
            drag ? "border-brand-2 bg-info-bg" : "border-line-2 bg-mute-bg/40",
          )}
        >
          <Upload className="size-7 text-ink-3" />
          <p className="text-sm text-ink-2">
            Drop files here or{" "}
            <button type="button" className="font-semibold text-brand-2 underline" onClick={() => inputRef.current?.click()}>
              choose files
            </button>
          </p>
          <p className="text-xs text-ink-3">PNG, JPG, WEBP, PDF, DOC, DOCX · up to {maxMb} MB each · max {MAX_FILES_PER_SAMPLE} files</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            className="sr-only"
            aria-label="Sample Output Photo / Document"
            onChange={(e) => {
              if (e.target.files?.length) handle(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      )}

      {uploading.map((u) => (
        <div key={u.name} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
          <Loader2 className="size-4 animate-spin text-brand-2" />
          <span className="flex-1 truncate text-sm">{u.name}</span>
          <div className="h-1.5 w-24 overflow-hidden rounded bg-mute-bg">
            <div className="h-full bg-brand-2" style={{ width: `${Math.round(u.progress * 100)}%` }} />
          </div>
        </div>
      ))}

      {files.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {files.map((f) => (
            <AttachmentCard
              key={f.id}
              file={f}
              onView={() => setViewing(f)}
              onRemove={canRemove ? () => onChange(files.filter((x) => x.id !== f.id)) : undefined}
            />
          ))}
        </ul>
      )}
      {!canUpload && files.length === 0 && <p className="text-sm text-ink-3">No files attached.</p>}

      <FileViewer file={viewing} onClose={() => setViewing(null)} />
    </div>
  );
}

export function AttachmentCard({
  file,
  onView,
  onRemove,
}: {
  file: AttachmentDTO;
  onView: () => void;
  onRemove?: () => void;
}) {
  const kind = fileKind(file.mimeType);
  return (
    <li className="flex items-center gap-3 rounded-lg border border-line bg-white p-2">
      <button type="button" onClick={onView} className="size-16 shrink-0 overflow-hidden rounded-md bg-mute-bg" aria-label={`View ${file.originalName}`}>
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl(file.id)} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <span className="flex size-full flex-col items-center justify-center text-[10px] font-bold text-info-fg uppercase">
            <FileText className="size-6" />
            {extOf(file.originalName)}
          </span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold" title={file.originalName}>{file.originalName}</p>
        <p className="text-xs text-ink-3">{formatBytes(file.sizeBytes)}</p>
      </div>
      <div className="flex shrink-0">
        <button type="button" className="icon-btn" onClick={onView} aria-label={`View ${file.originalName}`} title="View">
          <Eye className="size-[18px]" />
        </button>
        <a className="icon-btn" href={fileUrl(file.id, true)} aria-label={`Download ${file.originalName}`} title="Download">
          <Download className="size-[18px]" />
        </a>
        {onRemove && (
          <button type="button" className="icon-btn text-bad-fg" onClick={onRemove} aria-label={`Remove ${file.originalName}`} title="Remove">
            <Trash2 className="size-[18px]" />
          </button>
        )}
      </div>
    </li>
  );
}
