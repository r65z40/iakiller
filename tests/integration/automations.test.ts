import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createManualLead, listLeadActivity, listLeadTasks, updateLead } from "@/lib/leads/service";
import { createAutomation, runLeadAutomations, setAutomationEnabled } from "@/lib/leads/automations";
import { createOrgWithOwner, resetDb } from "../helpers";

const H = 3600_000;

describe("relances automatiques", () => {
  beforeEach(resetDb);

  it("refuse une règle « arrivée dans une étape » sans étape, et un délai borné", async () => {
    const { actor } = await createOrgWithOwner();
    await expect(createAutomation(actor, { name: "X", trigger: "stage_entered", action: "task", taskTitle: "t" })).rejects.toMatchObject({ code: "invalid" });
    await expect(createAutomation(actor, { name: "X", trigger: "stage_entered", triggerStage: "devis_envoye", action: "email" })).rejects.toMatchObject({ code: "invalid" });
  });

  it("déclenche une tâche après le délai, une seule fois (idempotent)", async () => {
    const { actor } = await createOrgWithOwner();
    const leadId = await createManualLead(actor, { name: "Paul", stage: "devis_envoye" });
    await createAutomation(actor, { name: "Relance devis", trigger: "stage_entered", triggerStage: "devis_envoye", delayHours: 24, action: "task", taskTitle: "Rappeler Paul" });

    // Avant l'échéance : rien.
    expect((await runLeadAutomations(new Date(Date.now() + 2 * H))).tasks).toBe(0);
    // Après l'échéance : une tâche.
    const r1 = await runLeadAutomations(new Date(Date.now() + 30 * H));
    expect(r1.tasks).toBe(1);
    expect(await listLeadTasks(actor, leadId)).toHaveLength(1);
    // Rejouée : pas de doublon.
    const r2 = await runLeadAutomations(new Date(Date.now() + 40 * H));
    expect(r2.tasks).toBe(0);
    expect(await listLeadTasks(actor, leadId)).toHaveLength(1);
    expect((await listLeadActivity(actor, leadId)).some((a) => a.activity.kind === "automation")).toBe(true);
  });

  it("envoie un email au prospect qui a une adresse, ignore ceux sans adresse", async () => {
    const { actor } = await createOrgWithOwner();
    await createManualLead(actor, { name: "Avec", email: "avec@exemple.test", stage: "nouveau" });
    await createManualLead(actor, { name: "Sans", phone: "0102030405", stage: "nouveau" });
    await createAutomation(actor, { name: "Bienvenue", trigger: "stage_entered", triggerStage: "nouveau", delayHours: 1, action: "email", emailSubject: "Merci", emailBody: "Bonjour,\nMerci de votre intérêt." });
    const r = await runLeadAutomations(new Date(Date.now() + 5 * H));
    expect(r.emails).toBe(1);
    const sent = await db.select().from(schema.emailOutbox).where(eq(schema.emailOutbox.to, "avec@exemple.test"));
    expect(sent).toHaveLength(1);
  });

  it("déclencheur « sans activité » : l'activité repousse l'échéance", async () => {
    const { actor } = await createOrgWithOwner();
    const leadId = await createManualLead(actor, { name: "Lent", stage: "a_contacter" });
    await createAutomation(actor, { name: "Réveil", trigger: "no_activity", delayHours: 48, action: "task", taskTitle: "Relancer" });
    // Une activité récente (changement d'étape) repousse le compteur.
    await updateLead(actor, leadId, { stage: "contacte" });
    expect((await runLeadAutomations(new Date(Date.now() + 10 * H))).tasks).toBe(0);
    expect((await runLeadAutomations(new Date(Date.now() + 60 * H))).tasks).toBe(1);
  });

  it("ne relance jamais un prospect gagné ou perdu (déclencheur sans activité)", async () => {
    const { actor } = await createOrgWithOwner();
    await createManualLead(actor, { name: "Gagné", stage: "gagne" });
    await createAutomation(actor, { name: "Réveil", trigger: "no_activity", delayHours: 1, action: "task", taskTitle: "Relancer" });
    expect((await runLeadAutomations(new Date(Date.now() + 100 * H))).tasks).toBe(0);
  });

  it("une règle en pause ne se déclenche pas", async () => {
    const { actor } = await createOrgWithOwner();
    await createManualLead(actor, { name: "Paul", stage: "nouveau" });
    const id = await createAutomation(actor, { name: "Pause", trigger: "stage_entered", triggerStage: "nouveau", delayHours: 1, action: "task", taskTitle: "t" });
    await setAutomationEnabled(actor, id, false);
    expect((await runLeadAutomations(new Date(Date.now() + 100 * H))).tasks).toBe(0);
  });
});
