"use client";

import { useState, useTransition } from "react";
import { LOCKABLE_FIELDS, type LockableField } from "@/lib/brand";
import { FONTS } from "@/lib/cards/constants";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { MediaPicker, type LibraryItem } from "@/components/editor/MediaPicker";
import { updateBrandAction } from "../_actions/brand";

export function BrandForm({ initial, library, canLock }: {
  initial: { primaryColor: string; backgroundColor: string; textColor: string; font: string; logoMediaId: string | null; companyName: string; lockedFields: string[] };
  library: LibraryItem[];
  canLock: boolean;
}) {
  const [v, setV] = useState(initial);
  const [lib, setLib] = useState(library);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => setV({ ...v, [k]: val });
  const color = (k: "primaryColor" | "backgroundColor" | "textColor", label: string) => (
    <Field label={label} htmlFor={k}>
      <div className="mt-1 flex gap-2">
        <input type="color" value={v[k]} onChange={(e) => set(k, e.target.value.toUpperCase())} aria-label={`${label} (sélecteur)`} className="h-11 w-12 rounded-lg border border-line p-1" />
        <Input id={k} value={v[k]} onChange={(e) => set(k, e.target.value.toUpperCase())} maxLength={7} className="mt-0 font-mono" />
      </div>
    </Field>
  );
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateBrandAction({ ...v, lockedFields: canLock ? v.lockedFields : undefined });
          setMsg(r.ok ? { ok: true, text: r.data } : { ok: false, text: r.error });
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {color("primaryColor", "Couleur principale")}
        {color("backgroundColor", "Fond de page")}
        {color("textColor", "Couleur du texte")}
      </div>
      <Field label="Police" htmlFor="font">
        <Select id="font" value={v.font} onChange={(e) => set("font", e.target.value)}>
          {Object.entries(FONTS).map(([id, f]) => <option key={id} value={id}>{f.label}</option>)}
        </Select>
      </Field>
      <Field label="Nom de la société affiché" htmlFor="companyName">
        <Input id="companyName" value={v.companyName} onChange={(e) => set("companyName", e.target.value)} maxLength={80} />
      </Field>
      <MediaPicker kind="image" label="Logo" library={lib} value={v.logoMediaId} onChange={(id) => set("logoMediaId", id)} onUploaded={(m) => setLib([m, ...lib])} />
      <fieldset className="rounded-lg border border-line p-4">
        <legend className="px-1 text-sm font-bold">Verrouillage pour toutes les cartes</legend>
        <p className="text-sm text-muted">Un champ verrouillé est imposé à toutes les cartes de l&apos;organisation ; les collaborateurs ne peuvent pas le modifier, même par l&apos;API.</p>
        {!canLock && <p className="mt-2 text-sm font-semibold text-warning">Seul le propriétaire peut modifier les verrous.</p>}
        <div className="mt-3 grid gap-1 sm:grid-cols-2">
          {(Object.entries(LOCKABLE_FIELDS) as [LockableField, string][]).map(([k, label]) => (
            <label key={k} className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4" disabled={!canLock} checked={v.lockedFields.includes(k)} onChange={(e) => set("lockedFields", e.target.checked ? [...v.lockedFields, k] : v.lockedFields.filter((x) => x !== k))} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {msg && <Alert tone={msg.ok ? "success" : "danger"}>{msg.text}</Alert>}
      <Button type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</Button>
    </form>
  );
}
