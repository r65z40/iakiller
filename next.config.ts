import type { NextConfig } from "next";

// Politique de sécurité du contenu. Les polices sont auto-hébergées (@fontsource) et le
// paiement Stripe se fait par redirection (aucun script tiers embarqué) : seules les vidéos
// YouTube/Vimeo, chargées au clic, nécessitent une source d'iframe. Les scripts et styles en
// ligne restent autorisés (bootstrap d'hydratation de Next, styles utilitaires).
// En développement, Next.js (React + Turbopack) a besoin de `eval` et d'un WebSocket pour le
// rechargement à chaud : on assouplit donc la politique uniquement dans ce mode. En production,
// la politique reste stricte (ni `unsafe-eval`, ni WebSocket élargi). React n'utilise jamais
// `eval` en production.
const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self'${isDev ? " ws: http: https:" : ""}`,
  "frame-src https://www.youtube-nocookie.com https://player.vimeo.com",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // HSTS uniquement en production (inutile en http local).
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["sharp", "pg"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
