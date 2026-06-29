"use client";

import { useEffect, useState } from "react";

interface Ad {
  id: string;
  name: string;
  content: string;
  imageUrl?: string;
  targetUrl?: string;
}

export default function AdBanner({ position }: { position: string }) {
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    fetch(`/api/admin/ads?position=${position}&active=true`)
      .then((res) => res.json())
      .then((data) => {
        if (data.ads?.length) setAds(data.ads);
      })
      .catch(() => {});
  }, [position]);

  if (ads.length === 0) {
    return (
      <div className="w-full my-4 p-4 rounded-lg border border-dashed border-[#1e1e4a] text-center text-dark-500 text-xs">
        Espace publicitaire
      </div>
    );
  }

  const ad = ads[Math.floor(Math.random() * ads.length)];

  const handleClick = () => {
    fetch(`/api/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "ad_click", adId: ad.id }),
    }).catch(() => {});

    if (ad.targetUrl) {
      window.open(ad.targetUrl, "_blank", "noopener,noreferrer");
    }
  };

  useEffect(() => {
    if (ad) {
      fetch(`/api/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "ad_impression", adId: ad.id }),
      }).catch(() => {});
    }
  }, [ad]);

  return (
    <div
      onClick={handleClick}
      className="w-full my-4 rounded-lg border border-[#1e1e4a] overflow-hidden cursor-pointer hover:border-primary-500/30 transition-colors"
    >
      {ad.imageUrl ? (
        <img src={ad.imageUrl} alt={ad.name} className="w-full h-auto" />
      ) : (
        <div
          className="p-4 text-center text-sm text-dark-300"
          dangerouslySetInnerHTML={{ __html: ad.content }}
        />
      )}
      <div className="text-[10px] text-dark-600 text-right px-2 py-1">Publicité</div>
    </div>
  );
}
