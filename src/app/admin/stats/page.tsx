"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Stats {
  processings: {
    total: number;
    todayCount: number;
    weekCount: number;
    monthCount: number;
    byType: { image: number; text: number; video: number };
    last30Days: { date: string; count: number }[];
  };
  sessions: {
    total: number;
    today: number;
    thisWeek: number;
  };
  ads: {
    total: number;
    active: number;
    totalImpressions: number;
    totalClicks: number;
    ctr: string;
  };
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => router.push("/admin/login"))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin w-8 h-8 text-primary-500" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  const maxCount = Math.max(
    ...stats.processings.last30Days.map((d) => d.count),
    1
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Statistiques détaillées</h1>
        <p className="text-dark-500 text-sm mt-1">Analyse complète de l&apos;activité</p>
      </div>

      {/* Processings overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card p-5">
          <p className="text-dark-500 text-xs mb-1">Total traitements</p>
          <p className="text-3xl font-bold">{stats.processings.total.toLocaleString()}</p>
        </div>
        <div className="stat-card p-5">
          <p className="text-dark-500 text-xs mb-1">Aujourd&apos;hui</p>
          <p className="text-3xl font-bold text-green-400">
            {stats.processings.todayCount.toLocaleString()}
          </p>
        </div>
        <div className="stat-card p-5">
          <p className="text-dark-500 text-xs mb-1">Cette semaine</p>
          <p className="text-3xl font-bold text-blue-400">
            {stats.processings.weekCount.toLocaleString()}
          </p>
        </div>
        <div className="stat-card p-5">
          <p className="text-dark-500 text-xs mb-1">Ce mois</p>
          <p className="text-3xl font-bold text-purple-400">
            {stats.processings.monthCount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Chart with more detail */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-6">Activité quotidienne (30 jours)</h2>
        <div className="space-y-2">
          {stats.processings.last30Days.map((day) => (
            <div key={day.date} className="flex items-center gap-3 text-xs">
              <span className="text-dark-500 w-20 flex-shrink-0">
                {new Date(day.date).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "short",
                })}
              </span>
              <div className="flex-1 h-5 bg-dark-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary-500 to-indigo-500 transition-all"
                  style={{
                    width: `${Math.max((day.count / maxCount) * 100, day.count > 0 ? 2 : 0)}%`,
                  }}
                />
              </div>
              <span className="text-dark-400 w-8 text-right">{day.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Type breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Répartition par type</h2>
          <div className="space-y-4">
            {[
              { label: "Images", count: stats.processings.byType.image, color: "from-purple-500 to-violet-500" },
              { label: "Textes", count: stats.processings.byType.text, color: "from-blue-500 to-cyan-500" },
              { label: "Vidéos", count: stats.processings.byType.video, color: "from-pink-500 to-rose-500" },
            ].map((item) => {
              const pct =
                stats.processings.total > 0
                  ? Math.round((item.count / stats.processings.total) * 100)
                  : 0;
              return (
                <div key={item.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{item.label}</span>
                    <span className="text-dark-400">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-3 bg-dark-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Performance publicitaire</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-[#1e1e4a]">
              <span className="text-dark-400">Publicités actives</span>
              <span className="font-semibold">{stats.ads.active} / {stats.ads.total}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-[#1e1e4a]">
              <span className="text-dark-400">Impressions totales</span>
              <span className="font-semibold">{stats.ads.totalImpressions.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-[#1e1e4a]">
              <span className="text-dark-400">Clics totaux</span>
              <span className="font-semibold">{stats.ads.totalClicks.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-dark-400">Taux de clics (CTR)</span>
              <span className="font-semibold text-green-400">{stats.ads.ctr}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sessions */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Utilisateurs</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-dark-900 rounded-lg">
            <p className="text-3xl font-bold">{stats.sessions.total.toLocaleString()}</p>
            <p className="text-dark-500 text-xs mt-1">Total</p>
          </div>
          <div className="text-center p-4 bg-dark-900 rounded-lg">
            <p className="text-3xl font-bold text-green-400">{stats.sessions.today}</p>
            <p className="text-dark-500 text-xs mt-1">Aujourd&apos;hui</p>
          </div>
          <div className="text-center p-4 bg-dark-900 rounded-lg">
            <p className="text-3xl font-bold text-blue-400">{stats.sessions.thisWeek}</p>
            <p className="text-dark-500 text-xs mt-1">Cette semaine</p>
          </div>
        </div>
      </div>
    </div>
  );
}
