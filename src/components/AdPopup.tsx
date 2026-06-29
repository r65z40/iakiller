"use client";

import { useEffect, useState, useCallback } from "react";
import { useLocale } from "@/components/LanguageProvider";
import { ts } from "@/lib/i18n";

interface Ad {
  id: string;
  name: string;
  content: string;
  imageUrl?: string;
  targetUrl?: string;
}

interface AdPopupProps {
  onClose: () => void;
}

export default function AdPopup({ onClose }: AdPopupProps) {
  const { locale } = useLocale();
  const pop = ts("popup", locale);
  const [ad, setAd] = useState<Ad | null>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    fetch("/api/admin/ads?position=popup&active=true")
      .then((res) => res.json())
      .then((data) => {
        if (data.ads?.length) {
          const picked = data.ads[Math.floor(Math.random() * data.ads.length)];
          setAd(picked);
          fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "ad_impression", adId: picked.id }),
          }).catch(() => {});
        } else {
          onClose();
        }
      })
      .catch(() => onClose());
  }, [onClose]);

  useEffect(() => {
    if (!ad) return;
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [ad, countdown]);

  const handleClick = useCallback(() => {
    if (!ad) return;
    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ad_click", adId: ad.id }),
    }).catch(() => {});
    if (ad.targetUrl) {
      window.open(ad.targetUrl, "_blank", "noopener,noreferrer");
    }
  }, [ad]);

  if (!ad) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md mx-4 card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-dark-900/50 border-b border-[#1e1e4a]">
          <span className="text-[10px] text-dark-500 uppercase tracking-wider">{pop.ad}</span>
          {countdown > 0 ? (
            <span className="text-xs text-dark-500">
              {pop.skipIn} {countdown}s
            </span>
          ) : (
            <button
              onClick={onClose}
              className="text-xs text-primary-400 hover:text-primary-300 font-medium"
            >
              {pop.skip} &rarr;
            </button>
          )}
        </div>

        <div onClick={handleClick} className="cursor-pointer">
          {ad.imageUrl ? (
            <img src={ad.imageUrl} alt={ad.name} className="w-full h-auto" />
          ) : (
            <div className="p-6 text-center">
              <div
                className="text-sm text-dark-300"
                dangerouslySetInnerHTML={{ __html: ad.content }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
