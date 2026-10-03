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

export function httpStatus(code: DomainErrorCode): number {
  switch (code) {
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "conflict":
    case "slug_taken":
      return 409;
    case "quota_exceeded":
    case "entitlement":
      return 402;
    case "not_configured":
      return 503;
    default:
      return 400;
  }
}
