import type { ComponentProps } from "react";

/** Lien de téléchargement d'un fichier généré par une route serveur (pas une navigation de page). */
export function DownloadLink(props: ComponentProps<"a">) {
   
  return <a {...props} />;
}
