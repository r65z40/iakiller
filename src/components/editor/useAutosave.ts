"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CardDocument } from "@/lib/cards/document";
import { saveDraftAction } from "@/app/app/_actions/cards";

export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict" | "invalid";

const RETRY_DELAYS = [2000, 5000, 10000, 20000, 30000];

/**
 * Enregistrement automatique du brouillon :
 * - temporisation après chaque modification ;
 * - nouvelle tentative progressive en cas d'erreur réseau (reprise après erreur) ;
 * - détection des conflits via le numéro de révision (pas d'écrasement silencieux).
 */
export function useAutosave(cardId: string, initialRevision: number) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const revision = useRef(initialRevision);
  const pending = useRef<{ doc: CardDocument; title: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const attempt = useRef(0);
  const conflictRevision = useRef<number | null>(null);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (inFlight.current) return false;
    const job = pending.current;
    if (!job) return true;
    inFlight.current = true;
    setStatus("saving");
    try {
      const res = await saveDraftAction(cardId, revision.current, job.doc, job.title);
      if (!res.ok) {
        setStatus("invalid");
        setError(res.error);
        inFlight.current = false;
        return false;
      }
      if (!res.data.ok) {
        conflictRevision.current = res.data.revision;
        setStatus("conflict");
        inFlight.current = false;
        return false;
      }
      revision.current = res.data.revision;
      attempt.current = 0;
      setSavedAt(new Date(res.data.savedAt));
      setError(null);
      // Une modification a pu arriver pendant l'envoi.
      if (pending.current === job) {
        pending.current = null;
        setStatus("saved");
      } else {
        setStatus("dirty");
        timer.current = setTimeout(() => void flush(), 300);
      }
      inFlight.current = false;
      return true;
    } catch {
      inFlight.current = false;
      setStatus("error");
      setError("Connexion perdue. Nouvelle tentative automatique…");
      const delay = RETRY_DELAYS[Math.min(attempt.current, RETRY_DELAYS.length - 1)];
      attempt.current++;
      timer.current = setTimeout(() => void flush(), delay);
      return false;
    }
  }, [cardId]);

  const schedule = useCallback(
    (doc: CardDocument, title: string) => {
      pending.current = { doc, title };
      if (status !== "conflict") setStatus("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 1200);
    },
    [flush, status],
  );

  /** Après un conflit : écraser avec la version locale, en repartant de la révision serveur. */
  const overwrite = useCallback(async () => {
    if (conflictRevision.current !== null) revision.current = conflictRevision.current;
    conflictRevision.current = null;
    setStatus("dirty");
    return flush();
  }, [flush]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pending.current) {
        e.preventDefault();
      }
    };
    const onOnline = () => {
      if (pending.current) void flush();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("online", onOnline);
    };
  }, [flush]);

  const setRevision = useCallback((r: number) => {
    revision.current = r;
    pending.current = null;
    setStatus("saved");
  }, []);

  return { status, error, savedAt, schedule, flush, overwrite, setRevision, hasPending: () => pending.current !== null };
}
