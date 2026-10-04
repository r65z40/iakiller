import { afterEach, describe, expect, it } from "vitest";
import { promoBanner } from "@/lib/config";
import { defaultSettings, type PlatformSettings } from "@/lib/settings/schema";

const g = globalThis as unknown as { __settings?: { value: PlatformSettings; loadedAt: number } };

function setPromo(promo: Partial<PlatformSettings["promo"]>) {
  const value = defaultSettings();
  value.promo = { ...value.promo, ...promo };
  g.__settings = { value, loadedAt: Date.now() };
}

afterEach(() => {
  g.__settings = undefined;
});

describe("promoBanner", () => {
  it("retourne null si désactivée ou message vide", () => {
    setPromo({ enabled: false, message: "Promo" });
    expect(promoBanner()).toBeNull();
    setPromo({ enabled: true, message: "   " });
    expect(promoBanner()).toBeNull();
  });

  it("retourne la bannière quand activée avec un message", () => {
    setPromo({ enabled: true, message: "−20% cette semaine", ctaLabel: "Voir", ctaHref: "/tarifs", tone: "success" });
    const b = promoBanner();
    expect(b).not.toBeNull();
    expect(b?.message).toBe("−20% cette semaine");
    expect(b?.tone).toBe("success");
    expect(b?.key.length).toBeGreaterThan(0);
  });

  it("respecte la fenêtre de dates", () => {
    setPromo({ enabled: true, message: "Promo", startsAt: "2026-02-01", endsAt: "2026-02-10" });
    expect(promoBanner(new Date("2026-01-15T12:00:00Z"))).toBeNull(); // avant
    expect(promoBanner(new Date("2026-02-05T12:00:00Z"))).not.toBeNull(); // pendant
    expect(promoBanner(new Date("2026-02-20T12:00:00Z"))).toBeNull(); // après
  });

  it("la clé change quand le message change (ré-affichage après masquage)", () => {
    setPromo({ enabled: true, message: "A" });
    const k1 = promoBanner()?.key;
    setPromo({ enabled: true, message: "B" });
    const k2 = promoBanner()?.key;
    expect(k1).not.toBe(k2);
  });
});
