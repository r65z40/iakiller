"use client";

import { useTransition } from "react";
import { buttonClass } from "@/components/ui";
import { revokeGrantAction } from "../_actions/support";

export function RevokeGrant({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} className={buttonClass("secondary", "sm")} onClick={() => start(async () => { await revokeGrantAction(id); })}>Révoquer</button>;
}
