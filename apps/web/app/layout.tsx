import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Silkscreen } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Pixel display face: hero words, stamps and big numbers only, at 32px+ (Section 6.2).
const silkscreen = Silkscreen({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-silkscreen",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "UOSBuddy · Find your batch. Find your people.", template: "%s · UOSBuddy" },
  description:
    "Find your batch, department and section at University of Sargodha. Make friends and get backup from batchmates and seniors.",
  applicationName: "UOSBuddy",
  appleWebApp: { capable: true, title: "UOSBuddy", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  icons: { icon: "/icons/192", apple: "/icons/192" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F2ECE1" },
    { media: "(prefers-color-scheme: dark)", color: "#0B0838" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} ${silkscreen.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply a saved theme before first paint to avoid a flash (see ThemeToggle). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("uosbuddy-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
