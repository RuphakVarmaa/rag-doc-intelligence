import GithubProvider from "next-auth/providers/github";
import EmailProvider from "next-auth/providers/email";
import type { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? "dev-secret-change-me");
}

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    }),
    EmailProvider({
      server: {
        host: "smtp.resend.com",
        port: 465,
        auth: {
          user: "resend",
          pass: process.env.RESEND_API_KEY ?? "",
        },
      },
      from: process.env.EMAIL_FROM ?? "noreply@yourdomain.com",
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/signin",
    error: "/auth/error",
  },
  jwt: {
    async encode({ token, maxAge }) {
      const secret = getSecret();
      return new SignJWT(token as JWT)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) + (maxAge ?? 30 * 24 * 60 * 60))
        .sign(secret);
    },
    async decode({ token }) {
      if (!token) return null;
      const secret = getSecret();
      try {
        const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
        return payload as JWT;
      } catch {
        return null;
      }
    },
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.sub = user.id ?? token.sub;
        token.email = user.email ?? "";
        token.name = user.name ?? undefined;
        token.picture = user.image ?? undefined;
      }
      if (account?.provider === "github") {
        token.sub = `github_${account.providerAccountId}`;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub;
      session.user.email = token.email;
      return session;
    },
  },
};
