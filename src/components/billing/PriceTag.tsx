import { formatMoney } from "@/lib/format";
import { annualSaving } from "@/lib/billing/pricing";

export function taxLabel(behavior: string) {
  return behavior === "exclusive" ? "HT" : behavior === "inclusive" ? "TTC" : "(HT/TTC à préciser)";
}

/** Affichage des prix : total annuel, équivalent mensuel et réduction calculée sur prix réels. */
export function PriceTag({ monthly, yearly, interval }: { monthly: { amountCents: number; taxBehavior: string } | null; yearly: { amountCents: number; taxBehavior: string } | null; interval: "month" | "year" }) {
  if (interval === "month") {
    if (!monthly) return <p className="text-sm text-muted">Prix mensuel non défini</p>;
    return (
      <p>
        <span className="text-3xl font-extrabold">{formatMoney(monthly.amountCents)}</span>
        <span className="text-sm text-muted"> {taxLabel(monthly.taxBehavior)} / mois</span>
      </p>
    );
  }
  if (!yearly) return <p className="text-sm text-muted">Prix annuel non défini</p>;
  const s = monthly ? annualSaving(monthly.amountCents, yearly.amountCents) : null;
  return (
    <div>
      <p>
        <span className="text-3xl font-extrabold">{formatMoney(yearly.amountCents)}</span>
        <span className="text-sm text-muted"> {taxLabel(yearly.taxBehavior)} / an</span>
      </p>
      {s && (
        <p className="text-sm text-muted">
          soit {formatMoney(s.monthlyEquivalent)} / mois{s.percent > 0 && <> · <strong className="text-success">{s.percent} % d&apos;économie</strong> par rapport au mensuel</>}
        </p>
      )}
    </div>
  );
}
