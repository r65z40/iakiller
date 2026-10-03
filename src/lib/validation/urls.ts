/**
 * Validation des liens publiés sur les cartes.
 * Seuls http(s), mailto et tel sont acceptés ; javascript:, data:, file:, etc. sont rejetés.
 */

const MAX_URL_LENGTH = 2048;

export function normalizeWebUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > MAX_URL_LENGTH) return null;
  // Ajoute https:// si l'utilisateur a saisi "www.exemple.fr".
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (!url.hostname || !url.hostname.includes(".")) return null;
  if (url.username || url.password) return null;
  return url.toString();
}

const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function isValidEmail(input: string): boolean {
  return input.length <= 254 && EMAIL_RE.test(input.trim());
}

/** Normalise un numéro de téléphone saisi (espaces, points, tirets tolérés). */
export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 32) return null;
  if (!/^\+?[0-9 .\-()]{4,}$/.test(raw)) return null;
  const digits = raw.replace(/[^0-9+]/g, "");
  if (digits.replace("+", "").length < 4 || digits.indexOf("+") > 0) return null;
  return digits;
}

/** Numéro au format international pour WhatsApp (wa.me exige l'indicatif sans +). */
export function toInternationalDigits(phone: string, defaultCountryCode = "33"): string | null {
  const n = normalizePhone(phone);
  if (!n) return null;
  if (n.startsWith("+")) return n.slice(1);
  if (n.startsWith("00")) return n.slice(2);
  if (n.startsWith("0")) return defaultCountryCode + n.slice(1);
  return n;
}

/**
 * Chemin de redirection interne sûr (anti open-redirect) : uniquement un chemin relatif
 * commençant par un seul "/".
 */
export function safeInternalPath(input: string | null | undefined, fallback = "/app"): string {
  if (!input) return fallback;
  // Les navigateurs retirent les caractères de contrôle (dont la tabulation) en analysant une
  // URL, si bien que "/\t/evil.com" devient "//evil.com". On les refuse donc tous, ainsi que
  // les antislashs, avant de vérifier que le résultat reste une URL relative à notre origine.
  if (!input.startsWith("/") || input.startsWith("//") || /[\u0000-\u001f\u007f\\]/.test(input)) return fallback;
  try {
    const resolved = new URL(input, "https://internal.invalid");
    if (resolved.origin !== "https://internal.invalid") return fallback;
    return resolved.pathname + resolved.search + resolved.hash;
  } catch {
    return fallback;
  }
}

const VIDEO_PATTERNS: { provider: "youtube" | "vimeo"; re: RegExp }[] = [
  { provider: "youtube", re: /^(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})/ },
  { provider: "youtube", re: /^(?:https?:\/\/)?(?:www\.)?youtu\.be\/([A-Za-z0-9_-]{11})/ },
  { provider: "youtube", re: /^(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})/ },
  { provider: "vimeo", re: /^(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d{4,12})(?:[/?#]|$)/ },
];

/** Extrait fournisseur et identifiant d'une URL vidéo autorisée. Aucun HTML d'intégration n'est accepté. */
export function parseVideoUrl(input: string): { provider: "youtube" | "vimeo"; videoId: string } | null {
  const raw = input.trim();
  for (const { provider, re } of VIDEO_PATTERNS) {
    const m = raw.match(re);
    if (m) return { provider, videoId: m[1] };
  }
  return null;
}

export function videoEmbedUrl(provider: "youtube" | "vimeo", videoId: string): string {
  if (provider === "youtube") return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1`;
  return `https://player.vimeo.com/video/${encodeURIComponent(videoId)}?autoplay=1&dnt=1`;
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
export function isHexColor(v: string): boolean {
  return HEX_RE.test(v);
}
