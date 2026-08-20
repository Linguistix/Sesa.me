import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères."),
});

/**
 * JWT sessions rather than database sessions: the public page is the hot path
 * and must not hit Postgres for auth, and the dashboard reads the user row
 * anyway. OAuth providers (Google, Spotify, YouTube) slot into `providers`
 * without changing anything else — the Account model is already in place.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });

        // Always run a hash comparison, even when the user does not exist, so
        // response time does not reveal which e-mails are registered.
        const hash = user?.passwordHash ?? BCRYPT_DUMMY_HASH;
        const ok = await bcrypt.compare(parsed.data.password, hash);

        if (!ok || !user?.passwordHash) return null;

        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) token.uid = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.uid && session.user) {
        session.user.id = token.uid as string;
      }
      return session;
    },
  },
});

/** A real bcrypt hash of a value nobody can supply, for constant-time misses. */
const BCRYPT_DUMMY_HASH = "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
