"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Navbar from "@/components/Navbar";
import AdBanner from "@/components/AdBanner";
import AdPopup from "@/components/AdPopup";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useToast } from "@/components/Toast";
import { useLocale } from "@/components/LanguageProvider";
import { ts } from "@/lib/i18n";

type TabType = "image" | "text" | "video";

interface QuotaInfo {
  used: number;
  limit: number;
  remaining: number;
  isPremium: boolean;
  noAds: boolean;
  popupAdEnabled: boolean;
}

function useQuota() {
  const [quota, setQuota] = useState<QuotaInfo | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/quota")
      .then((r) => r.json())
      .then(setQuota)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { quota, refresh };
}

export default function ToolPage() {
  const [activeTab, setActiveTab] = useState<TabType>("image");
  const { locale } = useLocale();
  const toolT = ts("tool", locale);
  const limT = ts("limits", locale);
  const { quota, refresh: refreshQuota } = useQuota();
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [premiumKey, setPremiumKey] = useState("");
  const [premiumError, setPremiumError] = useState("");
  const [premiumSuccess, setPremiumSuccess] = useState(false);
  const { toast } = useToast();

  const activatePremium = async () => {
    setPremiumError("");
    try {
      const res = await fetch("/api/premium", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: premiumKey }),
      });
      if (!res.ok) {
        setPremiumError(limT.invalidKey);
        return;
      }
      setPremiumSuccess(true);
      refreshQuota();
      toast(limT.activated, "success");
      setTimeout(() => {
        setShowPremiumModal(false);
        setPremiumSuccess(false);
        setPremiumKey("");
      }, 1500);
    } catch {
      setPremiumError(limT.invalidKey);
    }
  };

  const quotaPercent = quota ? Math.round((quota.used / quota.limit) * 100) : 0;

  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16 max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-2">
          {toolT.title}<span className="gradient-text">{toolT.titleHighlight}</span>{toolT.titleEnd}
        </h1>
        <p className="text-dark-400 text-center mb-6">{toolT.subtitle}</p>

        {/* Quota bar with animated progress */}
        {quota && (
          <div className="mb-6 card px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  quota.isPremium
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "bg-dark-800 text-dark-400 border border-dark-700"
                }`}>
                  {quota.isPremium ? limT.premiumBadge : limT.freeBadge}
                </span>
                <span className="text-sm text-dark-400">
                  <span className="text-white font-semibold">{quota.remaining}</span> {limT.remaining}
                </span>
              </div>
              {!quota.isPremium && (
                <button
                  onClick={() => setShowPremiumModal(true)}
                  className="text-xs text-primary-400 hover:text-primary-300 font-medium"
                >
                  {limT.activateKey}
                </button>
              )}
            </div>
            <div className="w-full h-1.5 bg-dark-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  quotaPercent > 80 ? "bg-red-500" : quotaPercent > 50 ? "bg-amber-500" : "bg-primary-500"
                }`}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-center mb-8">
          {(["image", "text", "video"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
                activeTab === tab ? "tab-active" : "tab-inactive"
              }`}
            >
              {tab === "image" ? toolT.tabImage : tab === "text" ? toolT.tabText : toolT.tabVideo}
            </button>
          ))}
        </div>

        {!(quota?.noAds) && <AdBanner position="header" />}

        <ErrorBoundary>
          {activeTab === "image" && <ImageProcessor quota={quota} onProcessed={refreshQuota} />}
          {activeTab === "text" && <TextProcessor quota={quota} onProcessed={refreshQuota} />}
          {activeTab === "video" && <VideoProcessor quota={quota} onProcessed={refreshQuota} />}
        </ErrorBoundary>

        {!(quota?.noAds) && <AdBanner position="footer" />}

        {/* Premium Modal */}
        {showPremiumModal && (
          <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="card p-6 w-full max-w-sm mx-4 space-y-4">
              <h3 className="text-lg font-semibold">{limT.activateKey}</h3>

              <div className="space-y-2 text-sm text-dark-400">
                <p className="font-medium text-white">{limT.premiumFeatures}:</p>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {limT.noAds}
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {limT.moreProcessings}
                </div>
              </div>

              {premiumSuccess ? (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm text-center">
                  {limT.activated}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={premiumKey}
                    onChange={(e) => setPremiumKey(e.target.value.toUpperCase())}
                    placeholder={limT.keyPlaceholder}
                    className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-4 py-2.5 text-sm text-center tracking-widest font-mono focus:border-primary-500/50 focus:outline-none"
                  />
                  {premiumError && (
                    <p className="text-red-400 text-xs">{premiumError}</p>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={activatePremium}
                      disabled={!premiumKey.trim()}
                      className="flex-1 py-2.5 rounded-lg gradient-bg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {limT.activate}
                    </button>
                    <button
                      onClick={() => { setShowPremiumModal(false); setPremiumError(""); setPremiumKey(""); }}
                      className="px-4 py-2.5 rounded-lg border border-[#1e1e4a] text-dark-400 text-sm hover:text-white"
                    >
                      {ts("popup", locale).close}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

interface ProcessorProps {
  quota: QuotaInfo | null;
  onProcessed: () => void;
}

function LimitReachedBanner() {
  const { locale } = useLocale();
  const limT = ts("limits", locale);

  return (
    <div className="card p-6 text-center space-y-3 border-amber-500/20">
      <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center">
        <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-amber-400">{limT.limitReached}</h3>
      <p className="text-sm text-dark-400 max-w-sm mx-auto">{limT.limitDesc}</p>
    </div>
  );
}

/* ──── Image Before/After Comparison ──── */
function ImageCompare({ beforeSrc, afterSrc }: { beforeSrc: string; afterSrc: string }) {
  const { locale } = useLocale();
  const i = ts("image", locale);
  const containerRef = useRef<HTMLDivElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const dragging = useRef(false);

  const updateSlider = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  }, []);

  const onMouseDown = useCallback(() => { dragging.current = true; }, []);
  const onMouseUp = useCallback(() => { dragging.current = false; }, []);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging.current) updateSlider(e.clientX);
  }, [updateSlider]);
  const onTouchMove = useCallback((e: React.TouchEvent) => {
    updateSlider(e.touches[0].clientX);
  }, [updateSlider]);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-lg overflow-hidden cursor-col-resize select-none"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchMove={onTouchMove}
      onTouchEnd={onMouseUp}
    >
      {/* After (full width, background) */}
      <img src={afterSrc} alt="After" className="w-full h-auto block" draggable={false} />

      {/* Before (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPos}%` }}
      >
        <img
          src={beforeSrc}
          alt="Before"
          className="w-full h-auto block"
          style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : "100%" }}
          draggable={false}
        />
      </div>

      {/* Slider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/80 shadow-lg"
        style={{ left: `${sliderPos}%` }}
        onMouseDown={onMouseDown}
        onTouchStart={onMouseDown}
      >
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-dark-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 px-2 py-1 rounded bg-black/60 text-xs text-white/80 backdrop-blur-sm">
        {i.before}
      </div>
      <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/60 text-xs text-white/80 backdrop-blur-sm">
        {i.after}
      </div>
    </div>
  );
}

function ImageProcessor({ quota, onProcessed }: ProcessorProps) {
  const { locale } = useLocale();
  const i = ts("image", locale);
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; info: Record<string, unknown> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [options, setOptions] = useState({
    addNoise: true,
    colorShift: true,
    microCrop: true,
    quality: 88,
    format: "jpeg" as "jpeg" | "png" | "webp",
    intensity: 75,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      setError(i.selectImage);
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, [i.selectImage]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const processImage = async () => {
    if (!file) return;

    if (quota && !quota.noAds && quota.popupAdEnabled) {
      setShowPopup(true);
    }

    setProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("options", JSON.stringify(options));

      const res = await fetch("/api/process/image", {
        method: "POST",
        body: formData,
      });

      if (res.status === 429) {
        setError("LIMIT_REACHED");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const info = JSON.parse(res.headers.get("X-Process-Info") || "{}");
      setResult({ url, info });
      onProcessed();
      toast(i.success, "success");
    } catch (err) {
      if (error !== "LIMIT_REACHED") {
        const msg = err instanceof Error ? err.message : "Error";
        setError(msg);
        toast(msg, "error");
      }
    } finally {
      setProcessing(false);
    }
  };

  const intensityLabel = options.quality <= 75 ? i.maximum : options.quality <= 88 ? i.optimal : i.light;

  if (error === "LIMIT_REACHED") return <LimitReachedBanner />;

  return (
    <div className="space-y-6">
      {showPopup && <AdPopup onClose={() => setShowPopup(false)} />}

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">{i.protectionLevel}</h2>
        <div className="mt-2">
          <label className="text-sm text-dark-400 block mb-2">
            {i.intensity}: {intensityLabel}
          </label>
          <input
            type="range"
            min="60"
            max="100"
            value={options.quality}
            onChange={(e) => {
              const q = parseInt(e.target.value);
              setOptions({ ...options, quality: q, intensity: Math.round(100 - (q - 60) * (75 / 40)) });
            }}
            className="w-full accent-primary-500"
          />
          <div className="flex justify-between text-xs text-dark-600 mt-1">
            <span>{i.maxProtection}</span>
            <span>{i.maxQuality}</span>
          </div>
        </div>
        <div className="mt-4">
          <label className="text-sm text-dark-400 block mb-1">{i.outputFormat}</label>
          <select
            value={options.format}
            onChange={(e) => setOptions({ ...options, format: e.target.value as "jpeg" | "png" | "webp" })}
            className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="jpeg">JPEG</option>
            <option value="png">PNG</option>
            <option value="webp">WebP</option>
          </select>
        </div>
      </div>

      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="dropzone card p-12 text-center cursor-pointer"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />
        {preview ? (
          <div className="space-y-4">
            <img src={preview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
            <p className="text-sm text-dark-400">{file?.name} — {((file?.size || 0) / 1024).toFixed(1)} KB</p>
          </div>
        ) : (
          <div>
            <svg className="w-12 h-12 mx-auto text-dark-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-dark-400 mb-1">{i.dropzone}</p>
            <p className="text-xs text-dark-600">{i.dropzoneSub}</p>
          </div>
        )}
      </div>

      {error && error !== "LIMIT_REACHED" && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {file && !result && (
        <button
          onClick={processImage}
          disabled={processing || (quota !== null && quota.remaining <= 0)}
          className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {i.processing}
            </span>
          ) : (
            i.cleanBtn
          )}
        </button>
      )}

      {result && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 text-green-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{i.success}</span>
          </div>

          {/* Before / After comparison */}
          {preview && (
            <ImageCompare beforeSrc={preview} afterSrc={result.url} />
          )}

          <div className="grid grid-cols-2 gap-4 text-xs text-dark-400">
            <div><span className="text-dark-500">{i.signaturesErased}</span> {i.signaturesVal}</div>
            <div><span className="text-dark-500">{i.fingerprintRebuilt}</span> {i.fingerprintVal}</div>
            <div><span className="text-dark-500">{i.authenticityRestored}</span> {i.authenticityVal}</div>
            <div><span className="text-dark-500">{i.detectionNeutralized}</span> {i.detectionVal}</div>
          </div>

          <a
            href={result.url}
            download={`iakiller_${Date.now()}.${options.format}`}
            className="block w-full py-3 rounded-xl gradient-bg text-white font-semibold text-center hover:opacity-90 transition-opacity"
          >
            {i.download}
          </a>

          <button
            onClick={() => { setFile(null); setPreview(null); setResult(null); }}
            className="w-full py-2 text-sm text-dark-400 hover:text-white transition-colors"
          >
            {i.processAnother}
          </button>
        </div>
      )}
    </div>
  );
}

function TextProcessor({ quota, onProcessed }: ProcessorProps) {
  const { locale } = useLocale();
  const i = ts("text", locale);
  const { toast } = useToast();

  const [text, setText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ processed: string; changes: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [options, setOptions] = useState({
    removeAiPatterns: true,
    varySentences: true,
    addNaturalImperfections: true,
    language: "auto" as "fr" | "en" | "auto",
  });

  const processText = async () => {
    if (!text.trim()) return;

    if (quota && !quota.noAds && quota.popupAdEnabled) {
      setShowPopup(true);
    }

    setProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/process/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, options }),
      });

      if (res.status === 429) {
        setError("LIMIT_REACHED");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error");
      }

      const data = await res.json();
      setResult(data);
      onProcessed();
      toast(i.success, "success");
    } catch (err) {
      if (error !== "LIMIT_REACHED") {
        const msg = err instanceof Error ? err.message : "Error";
        setError(msg);
        toast(msg, "error");
      }
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result.processed);
      toast(i.copied, "success");
    }
  };

  if (error === "LIMIT_REACHED") return <LimitReachedBanner />;

  return (
    <div className="space-y-6">
      {showPopup && <AdPopup onClose={() => setShowPopup(false)} />}

      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">{i.config}</h2>
        <div>
          <label className="text-sm text-dark-400 block mb-1">{i.textLanguage}</label>
          <select
            value={options.language}
            onChange={(e) => setOptions({ ...options, language: e.target.value as "fr" | "en" | "auto" })}
            className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="auto">{i.autoDetect}</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div className="card p-6">
        <label className="text-sm text-dark-400 block mb-2">{i.pasteLabel}</label>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setResult(null); }}
          placeholder={i.placeholder}
          rows={8}
          className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-4 py-3 text-sm resize-y focus:border-primary-500/50 focus:outline-none transition-colors"
        />
        <div className="text-xs text-dark-600 mt-1">{text.length} {i.characters}</div>
      </div>

      {error && error !== "LIMIT_REACHED" && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {text.trim() && !result && (
        <button
          onClick={processText}
          disabled={processing || (quota !== null && quota.remaining <= 0)}
          className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {i.processing}
            </span>
          ) : (
            i.cleanBtn
          )}
        </button>
      )}

      {result && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="font-medium">{i.success}</span>
            </div>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1.5 text-sm text-primary-400 hover:text-primary-300 px-3 py-1 rounded-lg hover:bg-primary-500/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {i.copy}
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {result.changes.map((change, idx) => (
              <span
                key={idx}
                className="px-2 py-1 rounded-full bg-primary-500/10 border border-primary-500/20 text-primary-300 text-xs"
              >
                {change}
              </span>
            ))}
          </div>

          <div className="bg-dark-900 border border-[#1e1e4a] rounded-lg p-4 text-sm whitespace-pre-wrap max-h-96 overflow-y-auto">
            {result.processed}
          </div>

          <button
            onClick={() => setResult(null)}
            className="w-full py-2 text-sm text-dark-400 hover:text-white transition-colors"
          >
            {i.processAnother}
          </button>
        </div>
      )}
    </div>
  );
}

function VideoProcessor({ quota, onProcessed }: ProcessorProps) {
  const { locale } = useLocale();
  const i = ts("video", locale);
  const { toast } = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const stagesEn = ["Analyzing file...", "Stripping signatures...", "Rebuilding frames...", "Encoding output...", "Finalizing..."];
  const stagesFr = ["Analyse du fichier...", "Suppression des signatures...", "Reconstruction des frames...", "Encodage de la sortie...", "Finalisation..."];
  const stages = locale === "fr" ? stagesFr : stagesEn;

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("video/")) {
      setError(i.selectVideo);
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      setError(i.tooLarge);
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  }, [i.selectVideo, i.tooLarge]);

  const startProgressSimulation = useCallback(() => {
    setProgress(0);
    setProgressStage(stages[0]);
    let current = 0;

    progressInterval.current = setInterval(() => {
      current += Math.random() * 2 + 0.5;
      if (current > 95) current = 95;

      setProgress(current);

      if (current < 15) setProgressStage(stages[0]);
      else if (current < 35) setProgressStage(stages[1]);
      else if (current < 65) setProgressStage(stages[2]);
      else if (current < 85) setProgressStage(stages[3]);
      else setProgressStage(stages[4]);
    }, 500);
  }, [stages]);

  const stopProgressSimulation = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  }, []);

  const processVideo = async () => {
    if (!file) return;

    if (quota && !quota.noAds && quota.popupAdEnabled) {
      setShowPopup(true);
    }

    setProcessing(true);
    setError(null);
    startProgressSimulation();

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/process/video", {
        method: "POST",
        body: formData,
      });

      stopProgressSimulation();

      if (res.status === 429) {
        setError("LIMIT_REACHED");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error");
      }

      setProgress(100);
      setProgressStage(locale === "fr" ? "Terminé !" : "Complete!");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResult(url);
      onProcessed();
      toast(i.success, "success");
    } catch (err) {
      stopProgressSimulation();
      if (error !== "LIMIT_REACHED") {
        const msg = err instanceof Error ? err.message : "Error";
        setError(msg);
        toast(msg, "error");
      }
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    return () => stopProgressSimulation();
  }, [stopProgressSimulation]);

  if (error === "LIMIT_REACHED") return <LimitReachedBanner />;

  return (
    <div className="space-y-6">
      {showPopup && <AdPopup onClose={() => setShowPopup(false)} />}

      <div
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !processing && fileInputRef.current?.click()}
        className={`dropzone card p-12 text-center ${processing ? "" : "cursor-pointer"}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="hidden"
        />
        {file ? (
          <div className="space-y-2">
            <svg className="w-12 h-12 mx-auto text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">{file.name}</p>
            <p className="text-xs text-dark-500">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
          </div>
        ) : (
          <div>
            <svg className="w-12 h-12 mx-auto text-dark-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-dark-400 mb-1">{i.dropzone}</p>
            <p className="text-xs text-dark-600">{i.dropzoneSub}</p>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {processing && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-dark-400">{progressStage}</span>
            <span className="text-primary-400 font-mono">{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-3 bg-dark-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full gradient-bg transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-dark-600">
            <span>{i.processing}</span>
            <span>{file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : ""}</span>
          </div>
        </div>
      )}

      {error && error !== "LIMIT_REACHED" && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
      )}

      {file && !result && !processing && (
        <button
          onClick={processVideo}
          disabled={quota !== null && quota.remaining <= 0}
          className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {i.cleanBtn}
        </button>
      )}

      {result && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 text-green-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{i.success}</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs text-dark-400">
            <div><span className="text-dark-500">{i.signaturesErased}</span> {i.signaturesVal}</div>
            <div><span className="text-dark-500">{i.fileRebuilt}</span> {i.fileVal}</div>
          </div>

          <a
            href={result}
            download={`iakiller_${Date.now()}.mp4`}
            className="block w-full py-3 rounded-xl gradient-bg text-white font-semibold text-center hover:opacity-90 transition-opacity"
          >
            {i.download}
          </a>

          <button
            onClick={() => { setFile(null); setResult(null); setProgress(0); }}
            className="w-full py-2 text-sm text-dark-400 hover:text-white transition-colors"
          >
            {i.processAnother}
          </button>
        </div>
      )}
    </div>
  );
}
