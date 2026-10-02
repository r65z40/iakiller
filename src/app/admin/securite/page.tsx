import { requireUser } from "@/lib/context";
import { Alert, PageHeader } from "@/components/ui";
import { SecurityPanel } from "@/app/app/parametres/SettingsClient";

export default async function AdminSecurity() {
  const user = await requireUser("/admin/securite");
  return (
    <div className="max-w-2xl">
      <PageHeader title="Sécurité requise" />
      <div className="mb-4"><Alert tone="warning">La double authentification est obligatoire pour accéder à l&apos;administration. Activez-la, puis reconnectez-vous si nécessaire.</Alert></div>
      <SecurityPanel twoFactorEnabled={user.twoFactorEnabled} />
    </div>
  );
}
