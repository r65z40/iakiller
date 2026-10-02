"use client";

import { useState } from "react";

/**
 * Histogramme journalier (une seule série : ouvertures mesurées). Infobulle au survol et
 * au focus clavier ; un tableau équivalent est fourni sous le graphique.
 */
export function DailyChart({ data }: { data: { day: string; views: number; actions: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length === 0) return <p className="text-sm text-muted">Aucune ouverture mesurée sur la période.</p>;
  const max = Math.max(1, ...data.map((d) => d.views));
  const W = 720, H = 180, pad = 24;
  const bw = (W - pad) / data.length;
  const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 20}`} className="w-full" role="img" aria-label={`Ouvertures mesurées par jour, maximum ${max}`}>
        <line x1={pad} x2={W} y1={H} y2={H} stroke="#e3e8f0" strokeWidth={1} />
        <text x={0} y={12} fontSize={11} fill="#5b6478">{max}</text>
        <text x={0} y={H} fontSize={11} fill="#5b6478">0</text>
        {data.map((d, i) => {
          const bh = (d.views / max) * (H - 16);
          const x = pad + i * bw + 1;
          const w = Math.max(2, bw - 2);
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${fmt(d.day)} : ${d.views} ouverture(s), ${d.actions} action(s)`}>
              <rect x={pad + i * bw} y={0} width={bw} height={H} fill="transparent" />
              {d.views > 0 && <path d={`M${x},${H} v${-Math.max(0, bh - 4)} q0,-4 4,-4 h${Math.max(0, w - 8)} q4,0 4,4 v${Math.max(0, bh - 4)} z`} fill={hover === i ? "#003a99" : "#0047BB"} />}
            </g>
          );
        })}
        <text x={pad} y={H + 16} fontSize={11} fill="#5b6478">{fmt(data[0].day)}</text>
        <text x={W} y={H + 16} fontSize={11} fill="#5b6478" textAnchor="end">{fmt(data[data.length - 1].day)}</text>
      </svg>
      {h && (
        <div className="pointer-events-none absolute top-0 rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-line" style={{ left: `${Math.min(80, ((hover! + 0.5) / data.length) * 100)}%` }}>
          <p className="font-semibold">{fmt(h.day)}</p>
          <p>{h.views} ouverture(s) · {h.actions} action(s)</p>
        </div>
      )}
      <details className="mt-2 text-sm">
        <summary className="cursor-pointer text-brand">Voir les données sous forme de tableau</summary>
        <table className="mt-2 w-full text-left">
          <thead className="text-xs text-muted"><tr><th>Jour</th><th>Ouvertures</th><th>Actions</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.day}><td>{fmt(d.day)}</td><td>{d.views}</td><td>{d.actions}</td></tr>)}</tbody>
        </table>
      </details>
    </div>
  );
}
