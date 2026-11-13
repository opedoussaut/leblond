import type { Metadata, Viewport } from "next";
import { Archivo, Inter } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { PwaRegister } from "@/components/pwa-register";
import { getViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

// Self-hosted at build time, no request to Google at runtime. Inter for reading;
// Archivo (with its width axis) for titles, grades and numbers.
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
const archivo = Archivo({ subsets: ["latin"], display: "swap", axes: ["wdth"], variable: "--font-archivo" });

export const metadata: Metadata = {
  title: { default: "LEBLOND", template: "%s · LEBLOND" },
  description: "Climbing progression and coaching with Patrick “Le Blond”.",
  applicationName: "LEBLOND",
  appleWebApp: { capable: true, title: "LEBLOND", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#f4f7fb" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await getViewer().catch(() => null);
  const { locale, t } = await getI18n(viewer?.profile.preferred_language);
  return (
    <html lang={locale} className={`${inter.variable} ${archivo.variable}`}>
      <body className="antialiased">
        <I18nProvider locale={locale} t={t}>
          {children}
        </I18nProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
