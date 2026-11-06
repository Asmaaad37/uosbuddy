"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileText, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The proof document, with zoom and rotate (Phase 1 task 7). PDFs open in a new tab. */
export function DocViewer({ url, path }: { url: string | null; path: string | null }) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Reset the view for each new document.
  useEffect(() => {
    setZoom(1);
    setRotation(0);
  }, [url]);

  if (!url) {
    return (
      <div className="grid h-80 place-items-center rounded-card bg-surface text-sec shadow-card">
        Document missing or deleted
      </div>
    );
  }

  if (path?.endsWith(".pdf")) {
    return (
      <div className="grid h-80 place-items-center gap-3 rounded-card border border-sep bg-surface text-center">
        <div className="grid justify-items-center gap-3">
          <FileText className="size-10 text-sec" />
          <Button asChild variant="secondary" size="md">
            <a href={url} target="_blank" rel="noopener noreferrer">
              Open PDF <ExternalLink />
            </a>
          </Button>
          <p className="text-[13px] text-sec">The link expires in 15 minutes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="relative h-[min(70vh,640px)] overflow-auto rounded-card border border-sep bg-raised">
        <div className="grid min-h-full min-w-full place-items-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */}
          <img
            src={url}
            alt="Proof document"
            className="max-h-full max-w-full origin-center transition-transform duration-150"
            style={{ transform: `rotate(${rotation}deg) scale(${zoom})` }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="secondary"
          aria-label="Zoom out"
          onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
        >
          <ZoomOut />
        </Button>
        <span className="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
        <Button
          size="icon"
          variant="secondary"
          aria-label="Zoom in"
          onClick={() => setZoom((z) => Math.min(4, z + 0.5))}
        >
          <ZoomIn />
        </Button>
        <Button
          size="icon"
          variant="secondary"
          aria-label="Rotate"
          onClick={() => setRotation((r) => (r + 90) % 360)}
        >
          <RotateCw />
        </Button>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-accent"
        >
          Original <ExternalLink className="size-4" />
        </a>
      </div>
    </div>
  );
}
