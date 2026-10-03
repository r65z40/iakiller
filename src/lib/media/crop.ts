/**
 * Calcul du rectangle de recadrage, partagé par l'aperçu (navigateur) et le serveur.
 * - aspect : largeur / hauteur du cadre voulu ;
 * - zoom ≥ 1 : 1 = plus grand cadre possible dans l'image ;
 * - x, y ∈ [0, 1] : position du cadre (0 = gauche/haut, 1 = droite/bas).
 */
export interface CropParams {
  aspect: number;
  zoom: number;
  x: number;
  y: number;
}

export function cropRect(width: number, height: number, p: CropParams) {
  const aspect = Math.min(Math.max(p.aspect, 0.2), 5);
  const zoom = Math.min(Math.max(p.zoom, 1), 5);
  let cw: number;
  let ch: number;
  if (width / height > aspect) {
    ch = height;
    cw = height * aspect;
  } else {
    cw = width;
    ch = width / aspect;
  }
  cw /= zoom;
  ch /= zoom;
  const x = Math.min(Math.max(p.x, 0), 1);
  const y = Math.min(Math.max(p.y, 0), 1);
  const left = Math.round((width - cw) * x);
  const top = Math.round((height - ch) * y);
  return { left, top, width: Math.max(1, Math.min(Math.round(cw), width - left)), height: Math.max(1, Math.min(Math.round(ch), height - top)) };
}
