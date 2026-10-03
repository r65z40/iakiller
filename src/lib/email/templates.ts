import { brand } from "@/lib/config";

/** Gabarits d'emails transactionnels. Fonctions pures, testables sans envoi. */

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function layout(title: string, paragraphs: string[], action?: { label: string; url: string }): RenderedEmail & { subject: string } {
  const text = [title, "", ...paragraphs, ...(action ? ["", `${action.label} : ${action.url}`] : []), "", `— ${brand.name}`].join("\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f4f6fa;font-family:Arial,Helvetica,sans-serif;color:#14213d">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;padding:28px">
<tr><td><p style="margin:0 0 16px;font-weight:bold;color:#0047BB">${esc(brand.name)}</p>
<h1 style="font-size:20px;margin:0 0 16px">${esc(title)}</h1>
${paragraphs.map((p) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px">${esc(p)}</p>`).join("\n")}
${action ? `<p style="margin:24px 0"><a href="${esc(action.url)}" style="background:#0047BB;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:bold">${esc(action.label)}</a></p><p style="font-size:12px;color:#5b6478;word-break:break-all">Si le bouton ne fonctionne pas : ${esc(action.url)}</p>` : ""}
</td></tr></table></td></tr></table></body></html>`;
  return { subject: title, text, html };
}

export const templates = {
  verifyEmail: (p: { name: string; url: string }) =>
    layout("Confirmez votre adresse email", [`Bonjour ${p.name},`, "Pour activer votre compte, confirmez votre adresse email. Ce lien expire dans une heure."], { label: "Confirmer mon email", url: p.url }),

  resetPassword: (p: { name: string; url: string }) =>
    layout("Réinitialisation de votre mot de passe", [`Bonjour ${p.name},`, "Une demande de réinitialisation a été faite pour votre compte. Si elle ne vient pas de vous, ignorez ce message. Ce lien expire dans une heure."], { label: "Choisir un nouveau mot de passe", url: p.url }),

  invitation: (p: { orgName: string; inviter: string; role: string; url: string; expires: string }) =>
    layout(`Invitation à rejoindre ${p.orgName}`, [`${p.inviter} vous invite à rejoindre l'organisation « ${p.orgName} » en tant que ${p.role}.`, `Cette invitation expire le ${p.expires}.`], { label: "Accepter l'invitation", url: p.url }),

  trialEnding: (p: { orgName: string; endsAt: string; url: string }) =>
    layout("Votre essai gratuit se termine bientôt", [`L'essai de l'organisation « ${p.orgName} » se termine le ${p.endsAt}.`, "Sans abonnement, vos cartes ne seront plus accessibles publiquement après cette date. Vos contenus ne sont pas supprimés automatiquement."], { label: "Choisir une formule", url: p.url }),

  trialEnded: (p: { orgName: string; url: string }) =>
    layout("Votre essai gratuit est terminé", [`L'essai de l'organisation « ${p.orgName} » est terminé. Vos cartes ne sont plus accessibles publiquement.`, "Aucun paiement n'a été prélevé. Vous pouvez souscrire à tout moment pour les réactiver."], { label: "Réactiver mes cartes", url: p.url }),

  subscriptionConfirmed: (p: { orgName: string; planName: string; url: string }) =>
    layout("Abonnement confirmé", [`L'abonnement « ${p.planName} » de « ${p.orgName} » est actif. Merci !`, "Vos factures sont disponibles dans votre espace."], { label: "Voir mon abonnement", url: p.url }),

  paymentFailed: (p: { orgName: string; graceUntil: string; url: string }) =>
    layout("Échec de paiement", [`Le dernier paiement de l'organisation « ${p.orgName} » a échoué.`, `Vos cartes restent accessibles jusqu'au ${p.graceUntil}. Mettez à jour votre moyen de paiement pour éviter leur suspension.`], { label: "Mettre à jour le paiement", url: p.url }),

  cancellationScheduled: (p: { orgName: string; endsAt: string; url: string }) =>
    layout("Résiliation enregistrée", [`L'abonnement de « ${p.orgName} » prendra fin le ${p.endsAt}. Vos cartes restent accessibles jusqu'à cette date, puis deviendront indisponibles.`, "Vous pouvez annuler la résiliation avant l'échéance."], { label: "Gérer mon abonnement", url: p.url }),

  subscriptionEnded: (p: { orgName: string; url: string }) =>
    layout("Abonnement terminé", [`L'abonnement de « ${p.orgName} » est terminé. Vos cartes ne sont plus accessibles publiquement.`, "Votre compte reste accessible pour consulter vos factures ou vous réabonner."], { label: "Me réabonner", url: p.url }),

  leadReceived: (p: { cardTitle: string; url: string }) =>
    layout("Nouvelle demande de contact", [`Une personne a envoyé une demande depuis la carte « ${p.cardTitle} ».`, "Pour protéger ses données, le détail est consultable uniquement dans votre espace."], { label: "Voir la demande", url: p.url }),

  serviceOrderUpdate: (p: { status: string; url: string }) =>
    layout("Votre création accompagnée avance", [`Nouveau statut : ${p.status}.`], { label: "Suivre ma demande", url: p.url }),

  supportReply: (p: { subject: string; url: string }) =>
    layout("Réponse de l'assistance", [`Une réponse a été apportée à votre demande « ${p.subject} ».`], { label: "Lire la réponse", url: p.url }),

  supportAccessGranted: (p: { orgName: string; staff: string; reason: string; until: string; url: string }) =>
    layout("Accès d'assistance ouvert", [`${p.staff} a ouvert un accès d'assistance temporaire à « ${p.orgName} » jusqu'au ${p.until}.`, `Motif : ${p.reason}`, "Chaque action est journalisée. Vous pouvez révoquer cet accès à tout moment."], { label: "Voir et révoquer", url: p.url }),

  backupFailed: (p: { error: string; url: string }) =>
    layout("Échec de la sauvegarde", ["La dernière sauvegarde de la plateforme a échoué.", `Erreur : ${p.error}`, "Les sauvegardes précédentes restent disponibles. Corrigez la cause puis relancez une sauvegarde."], { label: "Voir les sauvegardes", url: p.url }),

  backupStale: (p: { since: string; url: string }) =>
    layout("Sauvegardes en retard", [`Aucune sauvegarde réussie depuis ${p.since}.`, "Vérifiez la tâche planifiée (npm run jobs), la destination de sauvegarde et l'espace disponible."], { label: "Voir les sauvegardes", url: p.url }),
} satisfies Record<string, (p: never) => RenderedEmail>;

export type TemplateName = keyof typeof templates;
