import { Alert } from "@/components/ui";

export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const err = typeof sp.erreur === "string" ? sp.erreur : null;
  if (!ok && !err) return null;
  return <div className="mb-4">{ok ? <Alert tone="success">{ok}</Alert> : <Alert tone="danger">{err}</Alert>}</div>;
}
