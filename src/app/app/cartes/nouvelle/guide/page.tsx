import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireOrgPage } from "@/lib/context";
import { db, schema } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { GuideWizard } from "./GuideWizard";

export const metadata: Metadata = { title: "Création guidée" };
export const dynamic = "force-dynamic";

export default async function GuidePage() {
  const ctx = await requireOrgPage("cards.create");
  const [brand] = await db.select({ primaryColor: schema.brandSettings.primaryColor }).from(schema.brandSettings).where(eq(schema.brandSettings.organizationId, ctx.organization.id));
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Création guidée" description="Quelques questions suffisent. L'aperçu se met à jour en direct ; vous pourrez tout affiner ensuite." actions={<Link href="/app/cartes/nouvelle" className="text-sm font-semibold text-brand underline">← Retour</Link>} />
      <GuideWizard defaultColor={brand?.primaryColor ?? "#0047BB"} />
    </div>
  );
}
