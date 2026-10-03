import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { isBackupDue, isBackupStale, isoWeekKey, parisDayKey, selectRetained } from "@/lib/backup/policy";
import { decrypt, encrypt } from "@/lib/backup/crypto";

const at = (iso: string) => new Date(iso);

describe("rétention des sauvegardes", () => {
  it("calcule le jour à Paris et la semaine ISO", () => {
    expect(parisDayKey(at("2026-03-28T23:30:00Z"))).toBe("2026-03-29"); // UTC+1 → lendemain
    expect(isoWeekKey("2026-01-01")).toBe("2026-W01");
    expect(isoWeekKey("2027-01-01")).toBe("2026-W53");
  });

  it("garde la dernière sauvegarde de chaque jour, semaine et mois retenus", () => {
    const backups = [] as { id: string; startedAt: Date }[];
    // Deux sauvegardes par jour pendant 60 jours.
    for (let d = 0; d < 60; d++) {
      for (const h of [3, 15]) backups.push({ id: `${d}-${h}`, startedAt: new Date(Date.UTC(2026, 5, 30, h) - d * 86400_000) });
    }
    const keep = selectRetained(backups, { keepDaily: 7, keepWeekly: 4, keepMonthly: 3 });
    // 7 jours (sauvegarde de 15 h), plus les semaines et mois plus anciens.
    for (let d = 0; d < 7; d++) expect(keep.has(`${d}-15`)).toBe(true);
    expect(keep.has("0-3")).toBe(false);
    expect(keep.has("59-3")).toBe(false);
    expect(keep.size).toBeLessThanOrEqual(7 + 4 + 3);
    expect(keep.size).toBeGreaterThan(7);
  });

  it("garde toujours la plus récente, même avec une politique minimale", () => {
    const keep = selectRetained([{ id: "a", startedAt: at("2026-01-01T00:00:00Z") }, { id: "b", startedAt: at("2026-02-01T00:00:00Z") }], { keepDaily: 1, keepWeekly: 0, keepMonthly: 0 });
    expect([...keep]).toEqual(["b"]);
  });

  it("dit quand une sauvegarde est due ou en retard", () => {
    const now = at("2026-06-02T12:00:00Z");
    expect(isBackupDue(null, 24, now)).toBe(true);
    expect(isBackupDue(at("2026-06-01T12:05:00Z"), 24, now)).toBe(true); // marge du cron
    expect(isBackupDue(at("2026-06-02T06:00:00Z"), 24, now)).toBe(false);
    expect(isBackupStale(at("2026-06-01T12:00:00Z"), 24, now)).toBe(false);
    expect(isBackupStale(at("2026-05-31T08:00:00Z"), 24, now)).toBe(true);
    expect(isBackupStale(at("2026-06-01T08:00:00Z"), 6, now)).toBe(true); // 28 h > 26 h
  });
});

describe("chiffrement des sauvegardes", () => {
  it("chiffre, déchiffre et détecte toute altération", () => {
    const key = randomBytes(32);
    const plain = Buffer.from("données sensibles");
    const enc = encrypt(plain, key);
    expect(enc.includes(plain)).toBe(false);
    expect(decrypt(enc, key).equals(plain)).toBe(true);
    const tampered = Buffer.from(enc);
    tampered[tampered.length - 1] ^= 1;
    expect(() => decrypt(tampered, key)).toThrow();
    expect(() => decrypt(enc, randomBytes(32))).toThrow();
  });
});
