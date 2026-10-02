import { beforeEach, describe, expect, it } from "vitest";
import { db, schema } from "@/lib/db";
import { runAllJobs, rollupAnalytics, trialNotifications } from "@/lib/jobs";
import { createOrgWithOwner, resetDb } from "../helpers";

describe("tâches planifiées", () => {
  beforeEach(resetDb);

  it("envoie une seule fois le rappel de fin d'essai", async () => {
    const start = new Date(Date.now() - 6 * 86400_000);
    await createOrgWithOwner("Bientôt finie", start);
    await trialNotifications();
    await trialNotifications();
    const mails = (await db.select().from(schema.emailOutbox)).filter((m) => m.template === "trialEnding");
    expect(mails).toHaveLength(1);
  });

  it("agrège puis purge les événements anciens", async () => {
    const { actor } = await createOrgWithOwner();
    const { createCard } = await import("@/lib/cards/service");
    const c = await createCard(actor, { title: "Vieille" });
    const old = new Date(Date.now() - 400 * 86400_000);
    await db.insert(schema.analyticsEvent).values([
      { id: "ev1", organizationId: actor.organization.id, cardId: c.id, viewId: "a".repeat(24), type: "view", target: "", source: "qr", device: "mobile", browser: "safari", occurredAt: old },
      { id: "ev2", organizationId: actor.organization.id, cardId: c.id, viewId: "b".repeat(24), type: "view", target: "", source: "qr", device: "mobile", browser: "safari", occurredAt: old },
    ]);
    const r = await rollupAnalytics();
    expect(r.aggregated).toBe(2);
    const daily = await db.select().from(schema.analyticsDaily);
    expect(daily).toEqual([expect.objectContaining({ type: "view", source: "qr", count: 2 })]);
    expect(await db.select().from(schema.analyticsEvent)).toHaveLength(0);
  });

  it("exécute toutes les tâches sans erreur et les journalise", async () => {
    const results = await runAllJobs();
    expect(Object.values(results).some((r) => r && typeof r === "object" && "error" in r)).toBe(false);
    expect((await db.select().from(schema.jobRun)).every((j) => j.status === "ok")).toBe(true);
  });
});
