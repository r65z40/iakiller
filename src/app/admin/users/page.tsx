"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Session {
  id: string;
  firstSeen: string;
  lastSeen: string;
  processings: number;
  ip?: string;
  userAgent?: string;
}

interface Processing {
  id: string;
  type: string;
  sessionId: string;
  fileName?: string;
  fileSize?: number;
  processedAt: string;
}

export default function UsersPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [recentProcessings, setRecentProcessings] = useState<Processing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/admin/users")
      .then((res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setSessions(data.sessions);
          setTotal(data.total);
          setRecentProcessings(data.recentProcessings);
        }
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

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Utilisateurs</h1>
        <p className="text-dark-500 text-sm mt-1">{total} sessions uniques enregistrées</p>
      </div>

      {/* Sessions */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[#1e1e4a]">
          <h2 className="font-semibold">Sessions récentes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e4a] text-dark-500 text-xs">
                <th className="text-left p-3 font-medium">ID Session</th>
                <th className="text-left p-3 font-medium">Première visite</th>
                <th className="text-left p-3 font-medium">Dernière visite</th>
                <th className="text-left p-3 font-medium">Traitements</th>
                <th className="text-left p-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-dark-500">
                    Aucun utilisateur pour le moment
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr
                    key={session.id}
                    className="border-b border-[#1e1e4a]/50 hover:bg-[#16163a] transition-colors"
                  >
                    <td className="p-3 font-mono text-xs text-dark-400">
                      {session.id.substring(0, 8)}...
                    </td>
                    <td className="p-3 text-dark-300">
                      {new Date(session.firstSeen).toLocaleString("fr-FR")}
                    </td>
                    <td className="p-3 text-dark-300">
                      {new Date(session.lastSeen).toLocaleString("fr-FR")}
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-400 text-xs">
                        {session.processings}
                      </span>
                    </td>
                    <td className="p-3 text-dark-500 text-xs font-mono">
                      {session.ip || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent processings */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-[#1e1e4a]">
          <h2 className="font-semibold">Derniers traitements</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e1e4a] text-dark-500 text-xs">
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Fichier</th>
                <th className="text-left p-3 font-medium">Taille</th>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Session</th>
              </tr>
            </thead>
            <tbody>
              {recentProcessings.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-dark-500">
                    Aucun traitement pour le moment
                  </td>
                </tr>
              ) : (
                recentProcessings.map((proc) => (
                  <tr
                    key={proc.id}
                    className="border-b border-[#1e1e4a]/50 hover:bg-[#16163a] transition-colors"
                  >
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs ${
                          proc.type === "image"
                            ? "bg-purple-500/10 text-purple-400"
                            : proc.type === "text"
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-pink-500/10 text-pink-400"
                        }`}
                      >
                        {proc.type}
                      </span>
                    </td>
                    <td className="p-3 text-dark-300 text-xs truncate max-w-[200px]">
                      {proc.fileName || "—"}
                    </td>
                    <td className="p-3 text-dark-400 text-xs">
                      {proc.fileSize
                        ? proc.fileSize > 1024 * 1024
                          ? `${(proc.fileSize / (1024 * 1024)).toFixed(1)} MB`
                          : `${(proc.fileSize / 1024).toFixed(1)} KB`
                        : "—"}
                    </td>
                    <td className="p-3 text-dark-300 text-xs">
                      {new Date(proc.processedAt).toLocaleString("fr-FR")}
                    </td>
                    <td className="p-3 font-mono text-xs text-dark-500">
                      {proc.sessionId.substring(0, 8)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
