import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Inter } from "next/font/google";
import "./globals.css";
import SceneRoot from "@/components/scene/SceneRoot";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CIPHERA — Capture. Verify. Trust.",
  description:
    "Every photo carries proof of where it came from, sealed the instant you take it. CIPHERA lets you verify who captured a photo, when, and whether it's been altered.",
};

const THEME_BOOT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("ciphera-theme");
    if (stored === "light") {
      document.documentElement.classList.add("light");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fraunces.variable} ${plexMono.variable} ${inter.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="font-body bg-ink-950 text-paper antialiased">
        <SceneRoot />
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
