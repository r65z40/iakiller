"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SiteDocument } from "@/lib/sites/document";
import { saveSiteDraftAction } from "@/app/app/_actions/sites";

export type SaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict" | "invalid";

const RETRY_DELAYS = [2000, 5000, 10000, 20000, 30000];

/** Enregistrement automatique du brouillon d'un mini-site (temporisation + reprise + conflit). */
export function useSiteAutosave(siteId: string, initialRevision: number) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const revision = useRef(initialRevision);
  const pending = useRef<{ doc: SiteDocument; title: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const attempt = useRef(0);
  const conflictRevision = useRef<number | null>(null);
  const flushRef = useRef<() => Promise<boolean>>(async () => true);

  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (inFlight.current) return false;
    const job = pending.current;
    if (!job) return true;
    inFlight.current = true;
    setStatus("saving");
    try {
      const res = await saveSiteDraftAction(siteId, revision.current, job.doc, job.title);
      if (!res.ok) { setStatus("invalid"); setError(res.error); inFlight.current = false; return false; }
      if (!res.data.ok) { conflictRevision.current = res.data.revision; setStatus("conflict"); inFlight.current = false; return false; }
      revision.current = res.data.revision;
      attempt.current = 0;
      setSavedAt(new Date(res.data.savedAt));
      setError(null);
      if (pending.current === job) { pending.current = null; setStatus("saved"); }
      else { setStatus("dirty"); timer.current = setTimeout(() => void flushRef.current(), 300); }
      inFlight.current = false;
      return true;
    } catch {
      inFlight.current = false;
      setStatus("error");
      setError("Connexion perdue. Nouvelle tentative automatique…");
      const delay = RETRY_DELAYS[Math.min(attempt.current, RETRY_DELAYS.length - 1)];
      attempt.current++;
      timer.current = setTimeout(() => void flushRef.current(), delay);
      return false;
    }
  }, [siteId]);

  useEffect(() => { flushRef.current = flush; }, [flush]);

  const schedule = useCallback(
    (doc: SiteDocument, title: string) => {
      pending.current = { doc, title };
      if (status !== "conflict") setStatus("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 1200);
    },
    [flush, status],
  );

  const overwrite = useCallback(async () => {
    if (conflictRevision.current !== null) revision.current = conflictRevision.current;
    conflictRevision.current = null;
    setStatus("dirty");
    return flush();
  }, [flush]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => { if (pending.current) e.preventDefault(); };
    const onOnline = () => { if (pending.current) void flush(); };
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("online", onOnline);
    };
  }, [flush]);

  return { status, error, savedAt, schedule, flush, overwrite };
}
