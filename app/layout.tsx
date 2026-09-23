import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { AppProvider } from "@/components/AppProvider";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-fredoka", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  title: "The 90",
  description: "Hard days, together. Keep your flame alive with your crew.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/favicon.svg", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "The 90", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF1EA" },
    { media: "(prefers-color-scheme: dark)", color: "#10262D" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // data-theme follows the active clan (set by AppProvider); dark mode follows the OS.
  return (
    <html lang="en" data-theme="sunset" className={`${fredoka.variable} ${nunito.variable}`} suppressHydrationWarning>
      <body>
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
