"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/action-result";
import { Alert, Button } from "./index";

type Action = (prev: unknown, fd: FormData) => Promise<ActionResult<unknown> | undefined>;

/** Formulaire relié à une action serveur, avec message de résultat accessible. */
export function ActionForm({ action, children, className, successMessage }: { action: Action; children: ReactNode; className?: string; successMessage?: string }) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      {state && !state.ok && <div className="mt-3 sm:col-span-full"><Alert tone="danger">{state.error}</Alert></div>}
      {state && state.ok && (successMessage || typeof state.data === "string") && (
        <div className="mt-3 sm:col-span-full"><Alert tone="success">{typeof state.data === "string" ? state.data : successMessage}</Alert></div>
      )}
    </form>
  );
}

export function SubmitButton({ children, pendingLabel, variant, disabled, className }: { children: ReactNode; pendingLabel?: string; variant?: "primary" | "secondary" | "danger"; disabled?: boolean; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending || disabled} className={className}>
      {pending ? (pendingLabel ?? "Enregistrement…") : children}
    </Button>
  );
}
