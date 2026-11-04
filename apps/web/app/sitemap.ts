import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

/** Public pages only (#82: legal pages are public, unlike UniPal's). */
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ["/", "/start/campus", "/login", "/privacy", "/terms", "/guidelines", "/safety"];
  return pages.map((path) => ({
    url: new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.5,
  }));
}
