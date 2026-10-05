"use client";

import { Download, ExternalLink, FileText, Minus, Plus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { fileKind } from "@/lib/uploads";
import { formatBytes } from "@/lib/utils";

export interface ViewableFile {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

export const fileUrl = (id: string, download = false) => `/api/files/${id}${download ? "?download=1" : ""}`;

/** Preview dialog: zoomable images, the browser's PDF viewer, download for Word files. */
export function FileViewer({ file, onClose }: { file: ViewableFile | null; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  useEffect(() => setZoom(1), [file?.id]);
  const kind = file ? fileKind(file.mimeType) : "other";

  return (
    <Dialog
      open={!!file}
      onClose={onClose}
      size="xl"
      title={<span className="block truncate">{file?.originalName}</span>}
      footer={
        file && (
          <>
            {kind === "image" && (
              <div className="mr-auto flex items-center gap-1">
                <button type="button" className="btn-secondary btn-sm" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} aria-label="Zoom out">
                  <Minus className="size-4" />
                </button>
                <span className="w-14 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
                <button type="button" className="btn-secondary btn-sm" onClick={() => setZoom((z) => Math.min(5, z + 0.25))} aria-label="Zoom in">
                  <Plus className="size-4" />
                </button>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setZoom(1)} aria-label="Fit">
                  <RotateCcw className="size-4" />
                </button>
              </div>
            )}
            {kind !== "doc" && (
              <a className="btn-secondary btn-sm" href={fileUrl(file.id)} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" /> Open in new tab
              </a>
            )}
            <a className="btn-primary btn-sm" href={fileUrl(file.id, true)}>
              <Download className="size-4" /> Download
            </a>
          </>
        )
      }
    >
      {file && kind === "image" && (
        <div className="h-[65dvh] overflow-auto rounded-lg bg-mute-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fileUrl(file.id)}
            alt={file.originalName}
            style={zoom === 1 ? undefined : { width: `${zoom * 100}%`, maxWidth: "none" }}
            className={zoom === 1 ? "mx-auto max-h-full max-w-full object-contain" : "block"}
            onDoubleClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
          />
        </div>
      )}
      {file && kind === "pdf" && (
        <iframe title={file.originalName} src={fileUrl(file.id)} className="h-[70dvh] w-full rounded-lg border border-line" />
      )}
      {file && kind === "doc" && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <FileText className="size-14 text-info-fg" />
          <p className="font-semibold">{file.originalName}</p>
          <p className="text-sm text-ink-2">
            {formatBytes(file.sizeBytes)} · Word documents cannot be previewed in the browser — download to open in Word.
          </p>
        </div>
      )}
    </Dialog>
  );
}
