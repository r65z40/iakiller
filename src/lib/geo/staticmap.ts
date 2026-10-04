import sharp from "sharp";
import { appUrl } from "@/lib/config";

/**
 * Carte statique de « zone d'intervention », rendue côté serveur : on assemble des tuiles
 * OpenStreetMap puis on superpose un marqueur et le cercle du rayon. L'image est servie par
 * l'application depuis son propre domaine ; le navigateur du visiteur n'appelle aucun tiers.
 * Résilient : une tuile manquante est remplacée par un fond neutre, l'image est toujours produite.
 */

const TILE = 256;
const WIDTH = 640;
const HEIGHT = 360;

/** Zoom adapté au rayon (km) pour que le secteur tienne dans l'image. */
function zoomForRadius(radiusKm: number): number {
  if (radiusKm <= 0) return 12;
  if (radiusKm <= 2) return 13;
  if (radiusKm <= 5) return 12;
  if (radiusKm <= 10) return 11;
  if (radiusKm <= 20) return 10;
  if (radiusKm <= 40) return 9;
  if (radiusKm <= 80) return 8;
  if (radiusKm <= 150) return 7;
  return 6;
}

function lonToX(lon: number, z: number) {
  return ((lon + 180) / 360) * 2 ** z;
}
function latToY(lat: number, z: number) {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z;
}

async function fetchTile(z: number, x: number, y: number): Promise<Buffer | null> {
  const n = 2 ** z;
  if (x < 0 || y < 0 || x >= n || y >= n) return null;
  try {
    const res = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, {
      headers: { "User-Agent": `MaCartePro/1.0 (+${appUrl()})` },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const hex = (c: string, fallback: string) => (/^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback);

export async function renderZoneMap(input: { lat: number; lon: number; radiusKm: number; color?: string }): Promise<Buffer> {
  const z = zoomForRadius(input.radiusKm);
  const primary = hex(input.color ?? "", "#0047BB");

  const centerX = lonToX(input.lon, z) * TILE;
  const centerY = latToY(input.lat, z) * TILE;
  const left = centerX - WIDTH / 2;
  const top = centerY - HEIGHT / 2;

  const minTileX = Math.floor(left / TILE);
  const maxTileX = Math.floor((left + WIDTH) / TILE);
  const minTileY = Math.floor(top / TILE);
  const maxTileY = Math.floor((top + HEIGHT) / TILE);

  const composites: { input: Buffer; left: number; top: number }[] = [];
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      const buf = await fetchTile(z, tx, ty);
      const px = Math.round(tx * TILE - left);
      const py = Math.round(ty * TILE - top);
      if (buf) composites.push({ input: buf, left: px, top: py });
    }
  }

  // Cercle du rayon (mètres → pixels) et marqueur central.
  const mpp = (156543.03392 * Math.cos((input.lat * Math.PI) / 180)) / 2 ** z;
  const rPx = input.radiusKm > 0 ? Math.min(Math.round((input.radiusKm * 1000) / mpp), Math.max(WIDTH, HEIGHT)) : 0;
  const cx = Math.round(WIDTH / 2);
  const cy = Math.round(HEIGHT / 2);
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">` +
      (rPx > 0 ? `<circle cx="${cx}" cy="${cy}" r="${rPx}" fill="${esc(primary)}" fill-opacity="0.15" stroke="${esc(primary)}" stroke-opacity="0.8" stroke-width="2"/>` : "") +
      `<circle cx="${cx}" cy="${cy}" r="7" fill="${esc(primary)}" stroke="#ffffff" stroke-width="3"/>` +
      `</svg>`,
  );
  composites.push({ input: overlay, left: 0, top: 0 });

  // Fond neutre (visible là où une tuile manque), puis tuiles, puis superpositions.
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: "#e9edf2" } })
    .composite(composites)
    .png()
    .toBuffer();
}

export const ZONE_MAP_SIZE = { width: WIDTH, height: HEIGHT };
