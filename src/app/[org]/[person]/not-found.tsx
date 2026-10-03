export default function CardUnavailable() {
  return (
    <main id="contenu" className="flex min-h-dvh items-center justify-center bg-surface px-4">
      <div className="max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold">Carte indisponible</h1>
        <p className="mt-2 text-sm text-muted">Cette carte de visite n&apos;est pas accessible pour le moment. Contactez directement la personne ou l&apos;entreprise concernée.</p>
      </div>
    </main>
  );
}
