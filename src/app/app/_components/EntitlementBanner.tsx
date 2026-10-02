import Link from "next/link";
import type { Entitlement } from "@/lib/billing/entitlements";
import { formatDateTime } from "@/lib/format";

export function EntitlementBanner({ ent, canBill }: { ent: Entitlement; canBill: boolean }) {
  const cta = canBill ? (
    <Link href="/app/abonnement" className="font-bold underline">
      Choisir une formule
    </Link>
  ) : (
    <span>Contactez le propriétaire de l&apos;organisation.</span>
  );
  switch (ent.state) {
    case "trial_active":
      return (
        <div className="bg-brand-soft px-4 py-2 text-center text-sm text-ink">
          Essai gratuit jusqu&apos;au <strong>{formatDateTime(ent.until)}</strong> · {ent.quotas.cards} cartes maximum. {canBill && <Link href="/app/abonnement" className="font-bold text-brand underline">Voir les formules</Link>}
        </div>
      );
    case "trial_expired":
      return <div role="alert" className="bg-[#fff6e6] px-4 py-2 text-center text-sm text-[#7a3d00]">Votre essai est terminé : vos cartes ne sont plus accessibles publiquement. Vos contenus sont conservés. {cta}</div>;
    case "cancel_scheduled":
      return <div className="bg-[#fff6e6] px-4 py-2 text-center text-sm text-[#7a3d00]">Résiliation programmée : vos cartes resteront accessibles jusqu&apos;au <strong>{formatDateTime(ent.until)}</strong>. {canBill && <Link href="/app/abonnement" className="font-bold underline">Gérer</Link>}</div>;
    case "past_due_grace":
      return <div role="alert" className="bg-[#fdecea] px-4 py-2 text-center text-sm text-[#7a1a12]">Le dernier paiement a échoué. Vos cartes restent accessibles jusqu&apos;au <strong>{formatDateTime(ent.until)}</strong>. {canBill && <Link href="/app/abonnement" className="font-bold underline">Mettre à jour le paiement</Link>}</div>;
    case "payment_suspended":
      return <div role="alert" className="bg-[#fdecea] px-4 py-2 text-center text-sm text-[#7a1a12]">Cartes suspendues pour impayé. {canBill && <Link href="/app/abonnement" className="font-bold underline">Régulariser</Link>}</div>;
    case "ended":
      return <div role="alert" className="bg-[#fff6e6] px-4 py-2 text-center text-sm text-[#7a3d00]">Votre abonnement est terminé : vos cartes ne sont plus accessibles publiquement. {cta}</div>;
    case "admin_suspended":
      return <div role="alert" className="bg-[#fdecea] px-4 py-2 text-center text-sm text-[#7a1a12]">Organisation suspendue par la plateforme. Contactez l&apos;assistance.</div>;
    default:
      return null;
  }
}
