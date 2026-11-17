"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export type CroppedAvatar = { large: Blob; small: Blob; type: string };

const SIZES = { large: 512, small: 128 } as const;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function render(img: HTMLImageElement, area: Area, size: number, type: string) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Encoding failed"))), type, 0.85),
  );
}

/**
 * Square crop with drag and pinch/slider zoom, exported as 512 px and 128 px images
 * (§ avatars). Re-encoding also drops EXIF (location, device) from phone photos.
 */
export function AvatarCropper({
  src,
  onCancel,
  onDone,
}: {
  src: string;
  onCancel: () => void;
  onDone: (avatar: CroppedAvatar) => void;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  async function finish() {
    if (!area) return;
    setBusy(true);
    try {
      const img = await loadImage(src);
      // WebP where the browser can encode it (older Safari can't), else JPEG.
      let type = "image/webp";
      let large = await render(img, area, SIZES.large, type);
      if (large.type !== type) {
        type = "image/jpeg";
        large = await render(img, area, SIZES.large, type);
      }
      const small = await render(img, area, SIZES.small, type);
      onDone({ large, small, type });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogTitle>Crop your photo</DialogTitle>
        <DialogDescription>Drag to move. Pinch or use the slider to zoom.</DialogDescription>
        <div className="relative aspect-square w-full overflow-hidden rounded-card bg-black">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onComplete}
          />
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          aria-label="Zoom"
          className="w-full accent-[var(--accent)]"
        />
        <div className="flex justify-end gap-2">
          <Button variant="quiet" size="md" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="md" onClick={finish} disabled={busy || !area}>
            {busy ? "Saving…" : "Use photo"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
