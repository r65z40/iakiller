"use client";

import { useState, useRef, useCallback } from "react";
import Navbar from "@/components/Navbar";
import AdBanner from "@/components/AdBanner";

type TabType = "image" | "text" | "video";

export default function ToolPage() {
  const [activeTab, setActiveTab] = useState<TabType>("image");

  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16 max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-2">
          La <span className="gradient-text">magie</span> opère ici
        </h1>
        <p className="text-dark-400 text-center mb-8">
          Choisissez votre type de contenu et laissez notre algorithme faire le reste
        </p>

        {/* Tabs */}
        <div className="flex gap-2 justify-center mb-8">
          {(["image", "text", "video"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
                activeTab === tab ? "tab-active" : "tab-inactive"
              }`}
            >
              {tab === "image" ? "Image" : tab === "text" ? "Texte" : "Vidéo"}
            </button>
          ))}
        </div>

        <AdBanner position="header" />

        {activeTab === "image" && <ImageProcessor />}
        {activeTab === "text" && <TextProcessor />}
        {activeTab === "video" && <VideoProcessor />}

        <AdBanner position="footer" />
      </main>
    </>
  );
}

function ImageProcessor() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; info: Record<string, unknown> } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState({
    addNoise: true,
    colorShift: true,
    microCrop: true,
    quality: 88,
    format: "jpeg" as "jpeg" | "png" | "webp",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image");
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

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

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du traitement");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const info = JSON.parse(res.headers.get("X-Process-Info") || "{}");

      setResult({ url, info });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Niveau de protection</h2>
        <div className="mt-2">
          <label className="text-sm text-dark-400 block mb-2">
            Intensité : {options.quality <= 75 ? "Maximum" : options.quality <= 88 ? "Optimal" : "Léger"}
          </label>
          <input
            type="range"
            min="60"
            max="100"
            value={options.quality}
            onChange={(e) => setOptions({ ...options, quality: parseInt(e.target.value) })}
            className="w-full accent-primary-500"
          />
          <div className="flex justify-between text-xs text-dark-600 mt-1">
            <span>Protection maximale</span>
            <span>Qualité maximale</span>
          </div>
        </div>
        <div className="mt-4">
          <label className="text-sm text-dark-400 block mb-1">Format de sortie</label>
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

      {/* Upload zone */}
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
            <p className="text-dark-400 mb-1">Glissez une image ici ou cliquez pour parcourir</p>
            <p className="text-xs text-dark-600">PNG, JPG, WebP — Max 20 MB</p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {file && !result && (
        <button
          onClick={processImage}
          disabled={processing}
          className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Traitement en cours...
            </span>
          ) : (
            "Nettoyer l'image"
          )}
        </button>
      )}

      {result && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 text-green-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">Image nettoyée avec succès</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs text-dark-400">
            <div>
              <span className="text-dark-500">Signatures IA :</span> Effacées
            </div>
            <div>
              <span className="text-dark-500">Empreinte numérique :</span> Reconstruite
            </div>
            <div>
              <span className="text-dark-500">Authenticité :</span> Restaurée
            </div>
            <div>
              <span className="text-dark-500">Détection :</span> Neutralisée
            </div>
          </div>

          <a
            href={result.url}
            download={`iakiller_${Date.now()}.${options.format}`}
            className="block w-full py-3 rounded-xl gradient-bg text-white font-semibold text-center hover:opacity-90 transition-opacity"
          >
            Télécharger l&apos;image nettoyée
          </a>

          <button
            onClick={() => {
              setFile(null);
              setPreview(null);
              setResult(null);
            }}
            className="w-full py-2 text-sm text-dark-400 hover:text-white transition-colors"
          >
            Traiter une autre image
          </button>
        </div>
      )}
    </div>
  );
}

function TextProcessor() {
  const [text, setText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ processed: string; changes: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState({
    removeAiPatterns: true,
    varySentences: true,
    addNaturalImperfections: true,
    language: "auto" as "fr" | "en" | "auto",
  });

  const processText = async () => {
    if (!text.trim()) return;
    setProcessing(true);
    setError(null);

    try {
      const res = await fetch("/api/process/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, options }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du traitement");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setProcessing(false);
    }
  };

  const copyToClipboard = () => {
    if (result) {
      navigator.clipboard.writeText(result.processed);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Configuration</h2>
        <div>
          <label className="text-sm text-dark-400 block mb-1">Langue du texte</label>
          <select
            value={options.language}
            onChange={(e) => setOptions({ ...options, language: e.target.value as "fr" | "en" | "auto" })}
            className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-3 py-1.5 text-sm"
          >
            <option value="auto">Auto-détection</option>
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>

      <div className="card p-6">
        <label className="text-sm text-dark-400 block mb-2">
          Collez votre texte généré par IA
        </label>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          placeholder="Collez ici le texte à traiter..."
          rows={8}
          className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-4 py-3 text-sm resize-y focus:border-primary-500/50 focus:outline-none transition-colors"
        />
        <div className="text-xs text-dark-600 mt-1">{text.length} caractères</div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {text.trim() && !result && (
        <button
          onClick={processText}
          disabled={processing}
          className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Traitement en cours...
            </span>
          ) : (
            "Nettoyer le texte"
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
              <span className="font-medium">Texte nettoyé</span>
            </div>
            <button onClick={copyToClipboard} className="text-sm text-primary-400 hover:text-primary-300">
              Copier
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {result.changes.map((change, i) => (
              <span
                key={i}
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
            Traiter un autre texte
          </button>
        </div>
      )}
    </div>
  );
}

function VideoProcessor() {
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("video/")) {
      setError("Veuillez sélectionner une vidéo");
      return;
    }
    if (f.size > 100 * 1024 * 1024) {
      setError("La vidéo ne doit pas dépasser 100 MB");
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  }, []);

  const processVideo = async () => {
    if (!file) return;
    setProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/process/video", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Erreur lors du traitement");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setResult(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) handleFile(f);
        }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => fileInputRef.current?.click()}
        className="dropzone card p-12 text-center cursor-pointer"
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
            <p className="text-dark-400 mb-1">Glissez une vidéo ici ou cliquez pour parcourir</p>
            <p className="text-xs text-dark-600">MP4, MOV, AVI — Max 100 MB</p>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {file && !result && (
        <button
          onClick={processVideo}
          disabled={processing}
          className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {processing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Traitement en cours (peut prendre quelques minutes)...
            </span>
          ) : (
            "Nettoyer la vidéo"
          )}
        </button>
      )}

      {result && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-2 text-green-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">Vidéo nettoyée avec succès</span>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs text-dark-400">
            <div><span className="text-dark-500">Signatures IA :</span> Effacées</div>
            <div><span className="text-dark-500">Fichier :</span> Reconstruit</div>
          </div>

          <a
            href={result}
            download={`iakiller_${Date.now()}.mp4`}
            className="block w-full py-3 rounded-xl gradient-bg text-white font-semibold text-center hover:opacity-90 transition-opacity"
          >
            Télécharger la vidéo nettoyée
          </a>

          <button
            onClick={() => {
              setFile(null);
              setResult(null);
            }}
            className="w-full py-2 text-sm text-dark-400 hover:text-white transition-colors"
          >
            Traiter une autre vidéo
          </button>
        </div>
      )}
    </div>
  );
}
