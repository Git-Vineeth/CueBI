import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

const CUEBI_API = process.env.CUEBI_API_URL || "http://localhost:8000";

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== "google") return false;

      try {
        const res = await fetch(`${CUEBI_API}/api/auth/google-login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            google_id: account.providerAccountId,
            name: user.name,
            picture: user.image,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const detail = (err as any).detail || "access_denied";
          return `/login?error=${detail}`;
        }

        const data = await res.json() as {
          access_token: string;
          user: { user_id: string; team_id: string | null; role: string; org_id: string };
        };

        // Attach CueBI JWT and user metadata to the NextAuth user object
        (user as any).access_token = data.access_token;
        (user as any).team_id = data.user.team_id;
        (user as any).cuebi_role = data.user.role;
        (user as any).org_id = data.user.org_id;
        (user as any).cuebi_user_id = data.user.user_id;
        return true;
      } catch {
        return "/login?error=server_error";
      }
    },

    async jwt({ token, user }) {
      if (user) {
        const u = user as any;
        token.access_token = u.access_token;
        token.team_id = u.team_id;
        token.cuebi_role = u.cuebi_role;
        token.org_id = u.org_id;
        token.cuebi_user_id = u.cuebi_user_id;
      }
      return token;
    },

    async session({ session, token }) {
      (session as any).access_token = token.access_token;
      (session.user as any).team_id = token.team_id;
      (session.user as any).cuebi_role = token.cuebi_role;
      (session.user as any).org_id = token.org_id;
      (session.user as any).cuebi_user_id = token.cuebi_user_id;
      return session;
    },
  },
};
