import { requireOrgPage } from "@/lib/context";
import { getBrand } from "@/lib/brand-service";
import { listMedia } from "@/lib/media/service";
import { can } from "@/lib/permissions";
import { PageHeader, Panel } from "@/components/ui";
import { BrandForm } from "./BrandForm";

export default async function BrandPage() {
  const ctx = await requireOrgPage("brand.update");
  const [brand, media] = await Promise.all([getBrand(ctx.organization.id), listMedia(ctx)]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Identité d'entreprise" description="Couleurs, police et logo appliqués aux nouvelles cartes. Les champs verrouillés s'imposent à toutes les cartes." />
      <Panel>
        <BrandForm
          canLock={can(ctx, "brand.lock")}
          initial={{
            primaryColor: brand?.primaryColor ?? "#0047BB",
            backgroundColor: brand?.backgroundColor ?? "#E9EDF5",
            textColor: brand?.textColor ?? "#14213D",
            font: brand?.font ?? "inter",
            logoMediaId: brand?.logoMediaId ?? null,
            companyName: brand?.companyName ?? ctx.organization.name,
            lockedFields: brand?.lockedFields ?? [],
          }}
          library={media.map((m) => ({ id: m.id, kind: m.kind as "image" | "document", url: `/api/media/${m.id}`, name: m.originalName, sizeBytes: m.sizeBytes }))}
        />
      </Panel>
    </div>
  );
}
