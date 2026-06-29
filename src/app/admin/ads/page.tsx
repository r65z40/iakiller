"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Ad {
  id: string;
  name: string;
  type: string;
  position: string;
  content: string;
  imageUrl?: string;
  targetUrl?: string;
  active: boolean;
  impressions: number;
  clicks: number;
  createdAt: string;
}

export default function AdsPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAd, setEditingAd] = useState<Ad | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "banner",
    position: "header",
    content: "",
    imageUrl: "",
    targetUrl: "",
    active: true,
  });
  const router = useRouter();

  const fetchAds = () => {
    fetch("/api/admin/ads")
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setAds(data.ads);
      })
      .catch(() => router.push("/admin/login"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAds();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const url = editingAd
      ? `/api/admin/ads/${editingAd.id}`
      : "/api/admin/ads";
    const method = editingAd ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      setShowForm(false);
      setEditingAd(null);
      setForm({
        name: "",
        type: "banner",
        position: "header",
        content: "",
        imageUrl: "",
        targetUrl: "",
        active: true,
      });
      fetchAds();
    }
  };

  const handleEdit = (ad: Ad) => {
    setEditingAd(ad);
    setForm({
      name: ad.name,
      type: ad.type,
      position: ad.position,
      content: ad.content,
      imageUrl: ad.imageUrl || "",
      targetUrl: ad.targetUrl || "",
      active: ad.active,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette publicité ?")) return;
    const res = await fetch(`/api/admin/ads/${id}`, { method: "DELETE" });
    if (res.ok) fetchAds();
  };

  const handleToggle = async (ad: Ad) => {
    await fetch(`/api/admin/ads/${ad.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !ad.active }),
    });
    fetchAds();
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
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des publicités</h1>
          <p className="text-dark-500 text-sm mt-1">{ads.length} publicité(s) configurée(s)</p>
        </div>
        <button
          onClick={() => {
            setEditingAd(null);
            setForm({
              name: "",
              type: "banner",
              position: "header",
              content: "",
              imageUrl: "",
              targetUrl: "",
              active: true,
            });
            setShowForm(!showForm);
          }}
          className="px-4 py-2 rounded-lg gradient-bg text-white text-sm font-medium hover:opacity-90"
        >
          + Nouvelle publicité
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold">
            {editingAd ? "Modifier la publicité" : "Nouvelle publicité"}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-dark-400 block mb-1">Nom</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-4 py-2 text-sm focus:border-primary-500/50 focus:outline-none"
                placeholder="Ex: Banner header principal"
                required
              />
            </div>
            <div>
              <label className="text-sm text-dark-400 block mb-1">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-4 py-2 text-sm"
              >
                <option value="banner">Bannière</option>
                <option value="sidebar">Sidebar</option>
                <option value="interstitial">Interstitiel</option>
                <option value="native">Natif</option>
                <option value="popup">Popup</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-dark-400 block mb-1">Position</label>
              <select
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
                className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-4 py-2 text-sm"
              >
                <option value="header">Haut de page</option>
                <option value="content">Dans le contenu</option>
                <option value="sidebar">Barre latérale</option>
                <option value="footer">Bas de page</option>
                <option value="popup">Popup (au traitement)</option>
              </select>
            </div>
            <div>
              <label className="text-sm text-dark-400 block mb-1">URL de l&apos;image (optionnel)</label>
              <input
                type="url"
                value={form.imageUrl}
                onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-4 py-2 text-sm focus:border-primary-500/50 focus:outline-none"
                placeholder="https://..."
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-dark-400 block mb-1">URL cible</label>
            <input
              type="url"
              value={form.targetUrl}
              onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
              className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-4 py-2 text-sm focus:border-primary-500/50 focus:outline-none"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="text-sm text-dark-400 block mb-1">
              Contenu HTML (ou code AdSense)
            </label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={4}
              className="w-full bg-dark-900 border border-[#1e1e4a] rounded-lg px-4 py-2 text-sm resize-y focus:border-primary-500/50 focus:outline-none font-mono"
              placeholder='<div>Votre code publicitaire ici</div>'
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="rounded border-dark-600"
            />
            Active
          </label>

          <div className="flex gap-3">
            <button
              type="submit"
              className="px-6 py-2 rounded-lg gradient-bg text-white text-sm font-medium hover:opacity-90"
            >
              {editingAd ? "Enregistrer" : "Créer"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingAd(null);
              }}
              className="px-6 py-2 rounded-lg border border-[#1e1e4a] text-dark-400 text-sm hover:text-white"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Ads list */}
      <div className="space-y-3">
        {ads.length === 0 ? (
          <div className="card p-12 text-center text-dark-500">
            <p className="mb-2">Aucune publicité configurée</p>
            <p className="text-sm">Créez votre première publicité pour commencer à monétiser</p>
          </div>
        ) : (
          ads.map((ad) => (
            <div key={ad.id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium truncate">{ad.name}</h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs ${
                        ad.active
                          ? "bg-green-500/10 text-green-400 border border-green-500/20"
                          : "bg-dark-800 text-dark-500 border border-dark-700"
                      }`}
                    >
                      {ad.active ? "Active" : "Inactive"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-primary-500/10 text-primary-400 border border-primary-500/20">
                      {ad.position}
                    </span>
                  </div>
                  <div className="flex gap-6 text-xs text-dark-500">
                    <span>{ad.impressions.toLocaleString()} impressions</span>
                    <span>{ad.clicks.toLocaleString()} clics</span>
                    <span>
                      CTR:{" "}
                      {ad.impressions > 0
                        ? ((ad.clicks / ad.impressions) * 100).toFixed(2)
                        : "0"}
                      %
                    </span>
                    <span>
                      Créée le{" "}
                      {new Date(ad.createdAt).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(ad)}
                    className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white transition-colors"
                    title={ad.active ? "Désactiver" : "Activer"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {ad.active ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      )}
                    </svg>
                  </button>
                  <button
                    onClick={() => handleEdit(ad)}
                    className="p-2 rounded-lg hover:bg-dark-800 text-dark-400 hover:text-white transition-colors"
                    title="Modifier"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(ad.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-dark-400 hover:text-red-400 transition-colors"
                    title="Supprimer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
