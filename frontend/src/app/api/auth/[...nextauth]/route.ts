import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

const authOptions = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
      },
      async authorize(credentials) {
        const email = (credentials?.email as string)?.toLowerCase().trim();
        if (!email) return null;

        // Try login first
        let res = await fetch(`${BACKEND}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        let data = await res.json();

        if (!res.ok) {
          // Not found → sign up
          res = await fetch(`${BACKEND}/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email }),
          });
          data = await res.json();
          if (!res.ok) return null;
        }

        const apiKey = data.api_key;
        if (!apiKey) return null;

        // Fetch full profile
        const meRes = await fetch(`${BACKEND}/auth/me`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        const me = meRes.ok ? await meRes.json() : null;

        return {
          id: me?.user_id || email,
          email,
          name: email.split("@")[0],
          apiKey,
          premium: me?.premium || false,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.apiKey = user.apiKey;
        token.premium = user.premium;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.apiKey = token.apiKey as string;
        session.user.premium = token.premium as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth",
  },
  secret: process.env.NEXTAUTH_SECRET || "dev-secret-change-in-production",
};

export const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
