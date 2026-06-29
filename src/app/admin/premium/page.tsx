"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface PremiumKey {
  id: string;
  key: string;
  label: string;
  dailyLimit: number;
  noAds: boolean;
  active: boolean;
  usedBy: string[];
  createdAt: string;
  expiresAt?: string;
}

export default function PremiumPage() {
  const [keys, setKeys] = useState<PremiumKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    label: "",
    dailyLimit: 100,
    noAds: true,
    expiresAt: "",
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const router = useRouter();

  const fetchKeys = () => {
    fetch("/api/admin/premium")
      .then((res) => {
        if (res.status === 401) { router.push("/admin/login"); return null; }
        return res.json();
      })
      .then((data) => { if (data) setKeys(data.keys || []); })
      .catch(() => router.push("/admin/login"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchKeys(); }, [router]);

  const createKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/premium", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setShowForm(false);
      setForm({ label: "", dailyLimit: 100, noAds: true, expiresAt: "" });
      fetchKeys();
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Supprimer cette clé premium ?")) return;
    const res = await fetch("/api/admin/premium", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) fetchKeys();
  };

  const copyKey = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
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
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clés Premium</h1>
          <p className="text-dark-500 text-sm mt-1">{keys.length} clé(s) créée(s)</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 rounded-lg gradient-bg text-white text-sm font-medium hover:opacity-90"
        >
          + Nouvelle clé
        </button>
      </div>

      {showForm && (
        <form onSubmit={createKey} className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold">Générer une clé premium</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-dark-400 block mb-1">Label</label>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-4 py-2 text-sm focus:border-primary-500/50 focus:outline-none"
                placeholder="Ex: Client VIP, Testeur..."
                required
              />
            </div>
            <div>
              <label className="text-sm text-dark-400 block mb-1">Limite journalière</label>
              <input
                type="number"
                min="1"
                max="10000"
                value={form.dailyLimit}
                onChange={(e) => setForm({ ...form, dailyLimit: parseInt(e.target.value) || 100 })}
                className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-4 py-2 text-sm focus:border-primary-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-dark-400 block mb-1">Expiration (optionnel)</label>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-4 py-2 text-sm focus:border-primary-500/50 focus:outline-none"
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.noAds}
              onChange={(e) => setForm({ ...form, noAds: e.target.checked })}
              className="rounded border-dark-600"
            />
            Sans publicité
          </label>

          <div className="flex gap-3">
            <button type="submit" className="px-6 py-2 rounded-lg gradient-bg text-white text-sm font-medium hover:opacity-90">
              Générer la clé
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-2 rounded-lg border border-[#1e1e4a] text-dark-400 text-sm hover:text-white"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {keys.length === 0 ? (
          <div className="card p-12 text-center text-dark-500">
            <p className="mb-2">Aucune clé premium</p>
            <p className="text-sm">Créez des clés premium pour vos utilisateurs VIP</p>
          </div>
        ) : (
          keys.map((k) => (
            <div key={k.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium">{k.label}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      k.active
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : "bg-dark-800 text-dark-500 border border-dark-700"
                    }`}>
                      {k.active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <code className="bg-dark-900 px-3 py-1 rounded text-sm font-mono text-primary-300 border border-[#1e1e4a]">
                      {k.key}
                    </code>
                    <button
                      onClick={() => copyKey(k.key, k.id)}
                      className="text-xs text-dark-400 hover:text-primary-400"
                    >
                      {copiedId === k.id ? "Copié !" : "Copier"}
                    </button>
                  </div>

                  <div className="flex gap-6 text-xs text-dark-500">
                    <span>{k.dailyLimit} traitements/jour</span>
                    <span>{k.noAds ? "Sans pub" : "Avec pub"}</span>
                    <span>{k.usedBy.length} utilisateur(s)</span>
                    {k.expiresAt && (
                      <span>Expire: {new Date(k.expiresAt).toLocaleDateString("fr-FR")}</span>
                    )}
                    <span>Créée: {new Date(k.createdAt).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>
                <button
                  onClick={() => deleteKey(k.id)}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-dark-400 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Supprimer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
