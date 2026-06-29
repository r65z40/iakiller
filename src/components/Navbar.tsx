"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale } from "@/components/LanguageProvider";
import { t } from "@/lib/i18n";

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { locale, setLocale } = useLocale();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050510]/80 backdrop-blur-xl border-b border-[#1e1e4a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-bg flex items-center justify-center font-bold text-white text-sm">
              IA
            </div>
            <span className="text-lg font-bold gradient-text">IAKiller</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-dark-400 hover:text-white transition-colors text-sm">
              {t("nav", "home", locale)}
            </Link>
            <Link href="/tool" className="text-dark-400 hover:text-white transition-colors text-sm">
              {t("nav", "tool", locale)}
            </Link>

            <button
              onClick={() => setLocale(locale === "en" ? "fr" : "en")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#1e1e4a] text-dark-400 hover:text-white hover:border-primary-500/30 transition-colors text-xs font-medium"
            >
              <span className="text-base leading-none">{locale === "en" ? "🇫🇷" : "🇬🇧"}</span>
              {locale === "en" ? "FR" : "EN"}
            </button>

            <Link
              href="/tool"
              className="px-4 py-2 rounded-lg gradient-bg text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              {t("nav", "getStarted", locale)}
            </Link>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden text-dark-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            <Link href="/" className="block px-3 py-2 text-dark-400 hover:text-white text-sm">
              {t("nav", "home", locale)}
            </Link>
            <Link href="/tool" className="block px-3 py-2 text-dark-400 hover:text-white text-sm">
              {t("nav", "tool", locale)}
            </Link>
            <button
              onClick={() => setLocale(locale === "en" ? "fr" : "en")}
              className="flex items-center gap-1.5 px-3 py-2 text-dark-400 hover:text-white text-sm w-full"
            >
              <span className="text-base leading-none">{locale === "en" ? "🇫🇷" : "🇬🇧"}</span>
              {locale === "en" ? "Français" : "English"}
            </button>
            <Link
              href="/tool"
              className="block px-3 py-2 rounded-lg gradient-bg text-white text-sm font-medium text-center"
            >
              {t("nav", "getStarted", locale)}
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
