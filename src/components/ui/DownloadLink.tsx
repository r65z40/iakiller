import type { ComponentProps } from "react";

/** Lien de téléchargement d'un fichier généré par une route serveur (pas une navigation de page). */
export function DownloadLink(props: ComponentProps<"a">) {
  // eslint-disable-next-line @next/next/no-html-link-for-pages -- téléchargement de fichier
  return <a {...props} />;
}
