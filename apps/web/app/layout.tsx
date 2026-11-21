import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { BOOT_SCRIPT, BootSplash } from "@/components/boot-splash";
import { Providers } from "@/components/providers";
import { THEME_SCRIPT } from "@/components/theme-provider";
import "./globals.css";

// System type first (SF Pro on Apple devices); Inter is the fallback elsewhere (redesign §2).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "UOSBuddy · Find your batch. Find your people.", template: "%s · UOSBuddy" },
  description:
    "Find your batch, department and section at University of Sargodha. Make friends and get backup from batchmates and seniors.",
  applicationName: "UOSBuddy",
  appleWebApp: { capable: true, title: "UOSBuddy", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: "/icons/favicon", sizes: "48x48", type: "image/png" },
      { url: "/icons/192", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/icons/apple", sizes: "180x180", type: "image/png" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F6FC" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0F1F" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        {/* Apply the saved appearance before first paint, so there's no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* Hides the opening screen once the first screen is in (see BootSplash). */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh">
        <BootSplash />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
