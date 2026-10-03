"use client";

import { useState, useTransition } from "react";
import { Button, Textarea } from "@/components/ui";
import { replyTicketAction } from "../../_actions/support";

export function ReplyBox({ ticketId }: { ticketId: string }) {
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="mt-4">
      <label htmlFor="reply" className="text-sm font-semibold">Répondre</label>
      <Textarea id="reply" rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} />
      <Button type="button" size="sm" className="mt-2" disabled={pending || !text.trim()} onClick={() => start(async () => { const r = await replyTicketAction(ticketId, text); if (r.ok) setText(""); })}>Envoyer</Button>
    </div>
  );
}
