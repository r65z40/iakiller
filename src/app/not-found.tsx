export default function NotFound() {
  return (
    <main id="contenu" className="flex min-h-dvh items-center justify-center bg-surface px-4">
      <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold">Page introuvable</h1>
        <p className="mt-2 text-sm text-muted">L&apos;adresse demandée n&apos;existe pas ou n&apos;est plus disponible.</p>
      </div>
    </main>
  );
}
