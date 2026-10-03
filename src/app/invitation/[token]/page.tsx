import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/context";
import { findInvitation } from "@/lib/orgs/members";
import { ROLE_LABELS, type OrgRole } from "@/lib/permissions";
import { brand } from "@/lib/config";
import { AcceptButton } from "./AcceptButton";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

export default async function InvitationPage({ params }: PageProps<"/invitation/[token]">) {
  const { token } = await params;
  const [found, user] = await Promise.all([findInvitation(token), getCurrentUser()]);
  const next = `/invitation/${token}`;
  return (
    <main id="contenu" className="flex min-h-dvh items-start justify-center bg-surface px-4 pt-16">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-line">
        <p className="font-extrabold text-brand">{brand.name}</p>
        {!found || found.state !== "valid" ? (
          <>
            <h1 className="mt-4 text-xl font-bold">Invitation indisponible</h1>
            <p className="mt-2 text-sm text-muted">Ce lien est invalide, a expiré ou a déjà été utilisé. Demandez une nouvelle invitation.</p>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-bold">Rejoindre « {found.organization.name} »</h1>
            <p className="mt-2 text-sm">Rôle proposé : <strong>{ROLE_LABELS[found.invitation.role as OrgRole]}</strong>. Invitation adressée à <strong>{found.invitation.email}</strong>.</p>
            {user ? (
              user.email.toLowerCase() === found.invitation.email ? (
                <div className="mt-6"><AcceptButton token={token} /></div>
              ) : (
                <p className="mt-4 rounded-lg bg-[#fff6e6] p-3 text-sm">Vous êtes connecté avec {user.email}. Déconnectez-vous puis connectez-vous avec {found.invitation.email}.</p>
              )
            ) : (
              <div className="mt-6 flex flex-col gap-2 text-sm">
                <Link href={`/connexion?next=${encodeURIComponent(next)}`} className="rounded-lg bg-brand px-4 py-3 text-center font-semibold text-white">J&apos;ai déjà un compte</Link>
                <Link href="/inscription" className="rounded-lg px-4 py-3 text-center font-semibold ring-1 ring-line">Créer un compte avec {found.invitation.email}</Link>
                <p className="text-xs text-muted">Après inscription et confirmation de l&apos;email, revenez sur ce lien.</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
