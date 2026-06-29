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

export default function AdminDashboard() {
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

  if (!stats) return null;

  const maxCount = Math.max(...stats.processings.last30Days.map((d) => d.count), 1);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-dark-500 text-sm mt-1">Vue d&apos;ensemble de votre plateforme</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Traitements total"
          value={stats.processings.total}
          sub={`${stats.processings.todayCount} aujourd'hui`}
          color="purple"
        />
        <StatCard
          label="Utilisateurs"
          value={stats.sessions.total}
          sub={`${stats.sessions.today} aujourd'hui`}
          color="blue"
        />
        <StatCard
          label="Impressions pubs"
          value={stats.ads.totalImpressions}
          sub={`CTR: ${stats.ads.ctr}%`}
          color="green"
        />
        <StatCard
          label="Clics pubs"
          value={stats.ads.totalClicks}
          sub={`${stats.ads.active} pubs actives`}
          color="pink"
        />
      </div>

      {/* Chart */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Traitements (30 derniers jours)</h2>
        <div className="flex items-end gap-1 h-40">
          {stats.processings.last30Days.map((day) => (
            <div
              key={day.date}
              className="flex-1 group relative"
              title={`${day.date}: ${day.count}`}
            >
              <div
                className="chart-bar w-full min-h-[2px]"
                style={{
                  height: `${Math.max((day.count / maxCount) * 100, 2)}%`,
                }}
              />
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block bg-dark-800 text-xs px-2 py-1 rounded whitespace-nowrap border border-[#1e1e4a]">
                {day.date}: {day.count}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2 text-xs text-dark-600">
          <span>{stats.processings.last30Days[0]?.date}</span>
          <span>{stats.processings.last30Days[stats.processings.last30Days.length - 1]?.date}</span>
        </div>
      </div>

      {/* By type */}
      <div className="grid grid-cols-3 gap-4">
        <TypeCard label="Images" count={stats.processings.byType.image} total={stats.processings.total} color="from-purple-500 to-indigo-500" />
        <TypeCard label="Textes" count={stats.processings.byType.text} total={stats.processings.total} color="from-blue-500 to-cyan-500" />
        <TypeCard label="Vidéos" count={stats.processings.byType.video} total={stats.processings.total} color="from-pink-500 to-rose-500" />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  const colors: Record<string, string> = {
    purple: "from-purple-500/20 to-purple-600/5 border-purple-500/20",
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/20",
    green: "from-green-500/20 to-green-600/5 border-green-500/20",
    pink: "from-pink-500/20 to-pink-600/5 border-pink-500/20",
  };

  return (
    <div className={`rounded-xl p-5 bg-gradient-to-br border ${colors[color]}`}>
      <p className="text-dark-400 text-xs mb-1">{label}</p>
      <p className="text-3xl font-bold">{value.toLocaleString()}</p>
      <p className="text-dark-500 text-xs mt-1">{sub}</p>
    </div>
  );
}

function TypeCard({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="card p-5">
      <p className="text-dark-400 text-sm mb-2">{label}</p>
      <p className="text-2xl font-bold mb-3">{count.toLocaleString()}</p>
      <div className="w-full h-2 bg-dark-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-dark-500 mt-1">{pct}% du total</p>
    </div>
  );
}
