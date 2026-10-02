import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { appUrl, brand } from "@/lib/config";
import { sendEmail } from "@/lib/email/send";
import { templates } from "@/lib/email/templates";
import { newId } from "@/lib/ids";

/**
 * Authentification : Better Auth (email + mot de passe, email vérifié obligatoire,
 * réinitialisation, TOTP). Les sessions sont stockées en base et révocables.
 */
export const auth = betterAuth({
  appName: brand.name,
  baseURL: appUrl(),
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [appUrl()],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
      twoFactor: schema.twoFactor,
      rateLimit: schema.rateLimit,
    },
  }),
  advanced: {
    database: { generateId: () => newId() },
    useSecureCookies: appUrl().startsWith("https://"),
  },
  user: {
    additionalFields: {
      platformRole: { type: "string", required: false, input: false },
      disabledAt: { type: "date", required: false, input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: process.env.NODE_ENV !== "test",
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 300, max: 5 },
      "/request-password-reset": { window: 300, max: 5 },
      "/send-verification-email": { window: 300, max: 5 },
      "/two-factor/verify-totp": { window: 60, max: 6 },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({ to: user.email, template: "resetPassword", email: templates.resetPassword({ name: user.name, url }) });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 3600,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({ to: user.email, template: "verifyEmail", email: templates.verifyEmail({ name: user.name, url }) });
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Un compte désactivé par la plateforme ne peut plus ouvrir de session.
        before: async (session) => {
          const [u] = await db
            .select({ disabledAt: schema.user.disabledAt })
            .from(schema.user)
            .where(eq(schema.user.id, session.userId));
          if (u?.disabledAt) return false;
        },
      },
    },
  },
  plugins: [twoFactor({ issuer: brand.name }), nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
