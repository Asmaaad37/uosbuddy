"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase/lazy";
import { cn } from "@/lib/utils";

/**
 * Signed links for private buckets. A link lasts an hour, so the cache hands out a new one
 * when the old one is within 5 minutes of expiring, and a photo left on screen swaps in a
 * fresh link before its own runs out (C17). Failures aren't cached.
 */
const LIFETIME_S = 60 * 60;
const MARGIN_MS = 5 * 60_000;

type Entry = { url: Promise<string | null>; until: number };
const cache = new Map<string, Entry>();

export function signedUrl(bucket: string, path: string, { fresh = false } = {}) {
  const key = `${bucket}/${path}`;
  const hit = cache.get(key);
  if (!fresh && hit && hit.until - Date.now() > MARGIN_MS) return hit.url;

  const entry: Entry = {
    until: Date.now() + LIFETIME_S * 1000,
    url: browserClient().then(async (s) => {
      const { data } = await s.storage.from(bucket).createSignedUrl(path, LIFETIME_S);
      return data?.signedUrl ?? null;
    }),
  };
  cache.set(key, entry);
  void entry.url.then(
    (u) => !u && cache.get(key) === entry && cache.delete(key),
    () => cache.get(key) === entry && cache.delete(key),
  );
  return entry.url;
}

/** Seeds the cache, e.g. with a local preview right after an upload. */
export function primeSignedUrl(bucket: string, path: string, url: string) {
  cache.set(`${bucket}/${path}`, {
    url: Promise.resolve(url),
    until: url.startsWith("blob:") ? Infinity : Date.now() + LIFETIME_S * 1000,
  });
}

/**
 * A signed link for one private file that stays usable however long the page is open.
 * `seed` (made on the server, or a local preview) shows straight away; it's replaced before
 * it could expire, and once more if the image fails to load.
 */
export function useSignedUrl(bucket: string, path: string | null, seed?: string) {
  const [url, setUrl] = useState<string | null>(seed ?? null);
  const retried = useRef(false);

  useEffect(() => {
    if (!path) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = () =>
      void signedUrl(bucket, path).then((u) => {
        if (!live) return;
        if (u) setUrl(u);
        timer = setTimeout(load, LIFETIME_S * 1000 - MARGIN_MS);
      });
    // A seed is fresh enough to show; a local preview never expires.
    if (seed) {
      if (!seed.startsWith("blob:")) timer = setTimeout(load, LIFETIME_S * 1000 - MARGIN_MS);
    } else {
      load();
    }
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [bucket, path, seed]);

  // The browser said no (the link expired while the tab slept): get a new one, once.
  const onError = useCallback(() => {
    if (!path || retried.current) return;
    retried.current = true;
    void signedUrl(bucket, path, { fresh: true }).then((u) => u && setUrl(u));
  }, [bucket, path]);

  return { url, onError };
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
  const { url, onError } = useSignedUrl(bucket, path, seed);

  if (!url) return <div className={cn("animate-pulse bg-raised", className)} />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onError={onError}
        className={cn("object-cover", className)}
      />
    </a>
  );
}
