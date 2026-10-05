import { requireOrgPage } from "@/lib/context";
import { describeAutomation, listAutomations } from "@/lib/leads/automations";
import { PageHeader } from "@/components/ui";
import { RulesManager } from "./RulesManager";

export default async function RelancesPage() {
  const ctx = await requireOrgPage("leads.viewAll");
  const rules = await listAutomations(ctx);
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Relances automatiques"
        description="Automatisez le suivi de vos prospects : au bon moment, envoyez un email ou créez une tâche de rappel. Chaque relance ne se déclenche qu'une seule fois par prospect."
      />
      <RulesManager
        rules={rules.map((r) => ({
          id: r.id,
          name: r.name,
          enabled: r.enabled,
          action: r.action,
          summary: describeAutomation(r),
        }))}
      />
    </div>
  );
}
