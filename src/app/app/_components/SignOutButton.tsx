"use client";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <button
      type="button"
      className="text-sm text-muted underline"
      onClick={async () => {
        await authClient.signOut();
        window.location.assign("/connexion");
      }}
    >
      Se déconnecter
    </button>
  );
}
