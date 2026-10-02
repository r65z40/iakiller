"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { contactAction } from "./actions";

export function ContactForm() {
  const [state, action, pending] = useActionState(contactAction, null);
  if (state?.ok) return <div className="mt-6"><Alert tone="success">{state.message}</Alert></div>;
  return (
    <form action={action} className="mt-6 space-y-4">
      <Field label="Nom" htmlFor="name"><Input id="name" name="name" autoComplete="name" maxLength={120} /></Field>
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Société (facultatif)" htmlFor="company"><Input id="company" name="company" autoComplete="organization" maxLength={120} /></Field>
      <Field label="Message" htmlFor="message"><Textarea id="message" name="message" rows={6} required minLength={10} maxLength={4000} /></Field>
      <div aria-hidden className="absolute -left-[9999px]"><label>Ne pas remplir<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      <Button type="submit" disabled={pending}>{pending ? "Envoi…" : "Envoyer"}</Button>
    </form>
  );
}
