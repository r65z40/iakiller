import type { Metadata } from "next";
import { LanguageProvider } from "@/components/LanguageProvider";
import { ToastProvider } from "@/components/Toast";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "IAKiller — Make your AI content undetectable",
    template: "%s | IAKiller",
  },
  description:
    "Remove AI traces from your images, texts and videos. Our proprietary algorithm erases all invisible signatures. Free and instant.",
  keywords: [
    "AI detection bypass",
    "remove AI traces",
    "undetectable AI content",
    "AI image cleaner",
    "AI text rewriter",
    "AI video cleaner",
    "content authenticity",
  ],
  authors: [{ name: "IAKiller" }],
  creator: "IAKiller",
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: "fr_FR",
    siteName: "IAKiller",
    title: "IAKiller — Make your AI content undetectable",
    description:
      "Remove AI traces from your images, texts and videos. Our proprietary algorithm erases all invisible signatures. Free and instant.",
  },
  twitter: {
    card: "summary_large_image",
    title: "IAKiller — Make your AI content undetectable",
    description:
      "Remove AI traces from your images, texts and videos. Free and instant.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ErrorBoundary>
          <LanguageProvider>
            <ToastProvider>{children}</ToastProvider>
          </LanguageProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
