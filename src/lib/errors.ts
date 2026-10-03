export type DomainErrorCode =
  | "forbidden"
  | "not_found"
  | "quota_exceeded"
  | "conflict"
  | "invalid"
  | "entitlement"
  | "slug_taken"
  | "not_configured";

/** Erreur métier avec un message affichable en français. */
export class DomainError extends Error {
  constructor(
    public code: DomainErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

