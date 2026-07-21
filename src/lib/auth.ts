/**
 * Auth.js v5 configuration — credentials login for students and teachers.
 * Roles come from the User table; middleware.ts guards /student and
 * /teacher routes using the role carried on the JWT/session below.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "./db";
import { markPresentIfUnset } from "./attendance";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await db.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        if (user.role === "STUDENT") {
          try {
            await markPresentIfUnset(user.id, new Date());
          } catch (err) {
            console.error("attendance auto-mark failed on login", err);
            // deliberately swallowed — a marking bug must never block login
          }
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          language: user.language,
        };
      },
    }),
  ],
  callbacks: {
    // NOTE: deliberately no DB read here beyond sign-in. middleware.ts runs
    // this callback on the Edge runtime (verified live — Prisma's Node
    // query engine throws there), so this must stay a pure token
    // pass-through. Consequence: a language/role change made in Settings
    // takes effect on next sign-in, not immediately — see
    // docs/05-implementation-notes.md.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as "STUDENT" | "TEACHER" | "ADMIN";
        token.language = user.language as string;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.language = token.language;
      return session;
    },
  },
});
