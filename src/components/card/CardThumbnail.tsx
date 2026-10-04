import type { CardDocument } from "@/lib/cards/document";

/**
 * Aperçu miniature d'une carte (sans JavaScript ni chargement d'image) : reprend les couleurs
 * de la carte et surtout la DISPOSITION propre à chaque modèle, pour qu'on reconnaisse d'un
 * coup d'œil « classique », « portrait » ou « entreprise ». Rendu léger (styles en ligne).
 */
export function CardThumbnail({ doc }: { doc: CardDocument }) {
  const { identity, theme } = doc;
  const primary = theme.primaryColor || "#0047BB";
  const text = theme.textColor || "#14213D";
  const muted = theme.mutedColor || "#5b6478";
  const bg = theme.cardBackground || "#ffffff";
  const template = theme.template;
  const name = [identity.firstName, identity.lastName].filter(Boolean).join(" ") || identity.company || "Votre carte";
  const initials =
    ((identity.firstName?.[0] ?? "") + (identity.lastName?.[0] ?? "")).toUpperCase() ||
    (identity.company?.[0] ?? "C").toUpperCase();

  const avatar = (size: number, round: boolean) => (
    <div
      style={{
        width: size, height: size, borderRadius: round ? "50%" : 6, background: primary, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700,
        border: "2px solid #fff", boxShadow: "0 1px 3px rgba(20,33,61,0.2)", flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );

  const nameEl = <div style={{ fontSize: 12, fontWeight: 800, color: text, lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>;
  const jobEl = identity.jobTitle ? <div style={{ fontSize: 9.5, color: muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{identity.jobTitle}</div> : null;
  const companyEl = identity.company ? <div style={{ fontSize: 9.5, fontWeight: 700, color: primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{identity.company}</div> : null;
  const bar = <div style={{ height: 6, width: 42, background: primary, borderRadius: 3, marginTop: 6, opacity: 0.85 }} />;

  return (
    <div
      aria-hidden
      style={{ width: 132, height: 104, borderRadius: 12, overflow: "hidden", background: bg, border: "1px solid #e3e8f0", flexShrink: 0 }}
    >
      {/* Bandeau coloré */}
      <div style={{ height: template === "portrait" ? 34 : 26, background: `linear-gradient(135deg, ${primary}, ${primary}bb)` }} />
      {template === "entreprise" ? (
        <div style={{ padding: "0 8px" }}>
          <div style={{ marginTop: -14, display: "flex", alignItems: "flex-end", gap: 6 }}>{avatar(26, false)}</div>
          <div style={{ marginTop: 4, textAlign: "left" }}>
            {companyEl}
            {nameEl}
            {jobEl}
          </div>
        </div>
      ) : (
        <div style={{ padding: "0 8px", textAlign: "center" }}>
          <div style={{ marginTop: template === "portrait" ? -20 : -14, display: "flex", justifyContent: "center" }}>
            {avatar(template === "portrait" ? 38 : 28, true)}
          </div>
          <div style={{ marginTop: 4 }}>
            {nameEl}
            {jobEl}
            {companyEl}
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}>{bar}</div>
        </div>
      )}
    </div>
  );
}
