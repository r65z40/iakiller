"use client";

import { useState, useTransition } from "react";
import { Alert, Button } from "@/components/ui";
import { acceptInvitationAction } from "@/app/app/_actions/members";

export function AcceptButton({ token }: { token: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button type="button" className="w-full" disabled={pending} onClick={() => start(async () => { const r = await acceptInvitationAction(token); if (r && !r.ok) setError(r.error); })}>
        {pending ? "…" : "Accepter l'invitation"}
      </Button>
      {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}
    </>
  );
}
