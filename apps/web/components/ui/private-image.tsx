"use client";

import { useEffect, useState } from "react";
import { browserClient } from "@/lib/supabase/lazy";
import { cn } from "@/lib/utils";

/** Signed links for private buckets, fetched once per path and shared across the page. */
const cache = new Map<string, Promise<string | null>>();

export function signedUrl(bucket: string, path: string) {
  const key = `${bucket}/${path}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      browserClient().then(async (s) => {
        const { data } = await s.storage.from(bucket).createSignedUrl(path, 60 * 60);
        return data?.signedUrl ?? null;
      }),
    );
  }
  return cache.get(key)!;
}

/** Seeds the cache, e.g. with a local preview right after an upload. */
export function primeSignedUrl(bucket: string, path: string, url: string) {
  cache.set(`${bucket}/${path}`, Promise.resolve(url));
}

export function PrivateImage({
  bucket,
  path,
  seed,
  alt,
  className,
}: {
  bucket: string;
  path: string;
  /** A signed URL made on the server for the first page. */
  seed?: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(seed ?? null);
  useEffect(() => {
    if (seed) return;
    let live = true;
    void signedUrl(bucket, path).then((u) => live && setUrl(u));
    return () => {
      live = false;
    };
  }, [bucket, path, seed]);

  if (!url) return <div className={cn("animate-pulse bg-raised", className)} />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
      <img src={url} alt={alt} loading="lazy" className={cn("object-cover", className)} />
    </a>
  );
}
