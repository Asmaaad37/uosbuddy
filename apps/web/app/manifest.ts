import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/explore",
    name: "UOSBuddy",
    short_name: "UOSBuddy",
    description: "Find your batch. Find your people. Your campus backup at University of Sargodha.",
    start_url: "/explore",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0F1F",
    theme_color: "#0A0F1F",
    categories: ["education", "social"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
