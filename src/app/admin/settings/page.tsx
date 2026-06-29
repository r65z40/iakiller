"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Settings {
  dailyLimitFree: number;
  popupAdEnabled: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => {
        if (res.status === 401) { router.push("/admin/login"); return null; }
        return res.json();
      })
      .then((data) => { if (data) setSettings(data); })
      .catch(() => router.push("/admin/login"))
      .finally(() => setLoading(false));
  }, [router]);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin w-8 h-8 text-primary-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Paramètres</h1>
        <p className="text-dark-500 text-sm mt-1">Configuration de la plateforme</p>
      </div>

      <div className="card p-6 space-y-6">
        <h2 className="text-lg font-semibold">Limites de traitement</h2>

        <div>
          <label className="text-sm text-dark-400 block mb-1">
            Limite journalière (gratuit)
          </label>
          <input
            type="number"
            min="1"
            max="1000"
            value={settings.dailyLimitFree}
            onChange={(e) => setSettings({ ...settings, dailyLimitFree: parseInt(e.target.value) || 1 })}
            className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-4 py-2.5 text-sm focus:border-primary-500/50 focus:outline-none"
          />
          <p className="text-xs text-dark-600 mt-1">
            Nombre de traitements gratuits par jour par utilisateur
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Popup publicitaire</p>
            <p className="text-xs text-dark-500 mt-0.5">
              Affiche une publicité popup au lancement d&apos;un traitement
            </p>
          </div>
          <button
            onClick={() => setSettings({ ...settings, popupAdEnabled: !settings.popupAdEnabled })}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.popupAdEnabled ? "bg-primary-500" : "bg-dark-700"
            }`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
              settings.popupAdEnabled ? "translate-x-6" : "translate-x-0.5"
            }`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2.5 rounded-lg gradient-bg text-white text-sm font-medium hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Enregistrement..." : "Enregistrer"}
        </button>
        {saved && (
          <span className="text-green-400 text-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Enregistré
          </span>
        )}
      </div>
    </div>
  );
}
