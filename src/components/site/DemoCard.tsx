import { CardView } from "@/components/card/CardView";
import { DEMO_CARDS, DEMO_MEDIA } from "@/lib/cards/demo";

/** Démonstration réelle du rendu (mêmes composants que les cartes publiées), sans mesure. */
export function DemoCard({ id }: { id: string }) {
  const demo = DEMO_CARDS.find((d) => d.id === id)!;
  return (
    <div className="rounded-3xl p-4" style={{ background: demo.document.theme.pageBackground }}>
      <CardView doc={demo.document} media={DEMO_MEDIA} mode="public" />
    </div>
  );
}
