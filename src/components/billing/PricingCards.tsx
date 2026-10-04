"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { annualSaving } from "@/lib/billing/pricing";
import { taxLabel } from "./PriceTag";

export interface PlanCard {
  code: string;
  name: string;
  description: string;
  cardQuota: number;
  memberQuota: number;
  storageQuotaMb: number;
  monthlyCents: number | null;
  monthlyTax: string;
  yearlyCents: number | null;
  yearlyTax: string;
  popular: boolean;
}

function storage(mb: number) {
  return mb >= 1024 ? `${Math.round(mb / 1024)} Go` : `${mb} Mo`;
}

export function PricingCards({ plans }: { plans: PlanCard[] }) {
  const [interval, setInterval] = useState<"month" | "year">("month");
  const anyYearly = plans.some((p) => p.yearlyCents != null && p.monthlyCents != null);
  const bestSaving = Math.max(
    0,
    ...plans.map((p) => (p.monthlyCents != null && p.yearlyCents != null ? annualSaving(p.monthlyCents, p.yearlyCents).percent : 0)),
  );

  return (
    <div>
      {anyYearly && (
        <div className="mb-8 flex justify-center">
          <div role="tablist" aria-label="Période de facturation" className="inline-flex items-center gap-1 rounded-full bg-surface p-1 ring-1 ring-line">
            {([["month", "Mensuel"], ["year", "Annuel"]] as const).map(([k, label]) => (
              <button
                key={k}
                role="tab"
                aria-selected={interval === k}
                onClick={() => setInterval(k)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${interval === k ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"}`}
              >
                {label}
                {k === "year" && bestSaving > 0 && <span className="ml-1.5 rounded-full bg-success/15 px-1.5 py-0.5 text-xs font-bold text-success">−{bestSaving}%</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className={`grid items-stretch gap-6 ${plans.length >= 4 ? "lg:grid-cols-4 md:grid-cols-2" : "md:grid-cols-3"}`}>
        {plans.map((p) => {
          const cents = interval === "month" ? p.monthlyCents : p.yearlyCents;
          const tax = interval === "month" ? p.monthlyTax : p.yearlyTax;
          const saving = p.monthlyCents != null && p.yearlyCents != null ? annualSaving(p.monthlyCents, p.yearlyCents) : null;
          return (
            <li
              key={p.code}
              className={`relative flex flex-col rounded-2xl bg-white p-6 ${p.popular ? "shadow-xl ring-2 ring-brand lg:-mt-3 lg:mb-3" : "ring-1 ring-line"}`}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" /> Le plus populaire
                </span>
              )}
              <h2 className="text-lg font-extrabold">{p.name}</h2>
              <p className="mt-1 min-h-10 text-sm text-muted">{p.description}</p>

              <div className="mt-5">
                {cents == null ? (
                  <p className="text-sm text-muted">Prix {interval === "month" ? "mensuel" : "annuel"} à venir</p>
                ) : (
                  <>
                    <p className="flex items-end gap-1">
                      <span className="text-4xl font-extrabold tracking-tight">{formatMoney(cents)}</span>
                      <span className="pb-1 text-sm text-muted">{taxLabel(tax)} / {interval === "month" ? "mois" : "an"}</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {interval === "year" && saving
                        ? <>soit {formatMoney(saving.monthlyEquivalent)} / mois{saving.percent > 0 && <> · <strong className="text-success">{saving.percent}% d&apos;économie</strong></>}</>
                        : "Sans engagement au-delà de la période payée."}
                    </p>
                  </>
                )}
              </div>

              <Link
                href="/inscription"
                className={`mt-6 rounded-xl px-4 py-3 text-center font-semibold transition ${p.popular ? "bg-brand text-white shadow-lg shadow-brand/25 hover:bg-brand-dark" : "bg-surface text-ink ring-1 ring-line hover:bg-white"}`}
              >
                Commencer l&apos;essai gratuit
              </Link>

              <ul className="mt-6 space-y-2.5 text-sm">
                <Feature><strong>{p.cardQuota}</strong> carte{p.cardQuota > 1 ? "s" : ""} numérique{p.cardQuota > 1 ? "s" : ""}</Feature>
                <Feature><strong>{p.memberQuota}</strong> membre{p.memberQuota > 1 ? "s" : ""} d&apos;équipe</Feature>
                <Feature><strong>{storage(p.storageQuotaMb)}</strong> de stockage</Feature>
                <Feature>QR codes multi-origines + statistiques</Feature>
                <Feature>Formulaire sur mesure + prospects</Feature>
                <Feature>Signature email + fiche vCard</Feature>
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Feature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <span>{children}</span>
    </li>
  );
}
