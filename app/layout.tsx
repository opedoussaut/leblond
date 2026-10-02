import type { Metadata, Viewport } from "next";
import { I18nProvider } from "@/components/i18n-provider";
import { PwaRegister } from "@/components/pwa-register";
import { getViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import "./globals.css";

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
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#12110e" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await getViewer().catch(() => null);
  const { locale, t } = await getI18n(viewer?.profile.preferred_language);
  return (
    <html lang={locale}>
      <body className="antialiased">
        <I18nProvider locale={locale} t={t}>
          {children}
        </I18nProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
