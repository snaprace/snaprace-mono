import { type DefaultSession, type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { SupabaseAdapter } from "@auth/supabase-adapter";
import { env } from "@/env";
import { createServerClient } from "@repo/supabase";

/**
 * Module augmentation for `next-auth` types.
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: "PARTICIPANT" | "ORGANIZER" | "SUPER_ADMIN";
      organizationId?: string; // For organizers
    } & DefaultSession["user"];
  }

  interface User {
    role: "PARTICIPANT" | "ORGANIZER" | "SUPER_ADMIN";
  }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
export const authConfig = {
  adapter: SupabaseAdapter({
    url: env.SUPABASE_URL,
    secret: (env as any).SUPABASE_SERVICE_ROLE_KEY,
  }) as any,
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: (env as any).GOOGLE_CLIENT_ID,
      clientSecret: (env as any).GOOGLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        console.log(">>>> AUTH: authorize called", { email: credentials?.email });
        if (!credentials?.email || !credentials?.password) return null;

        const supabase = createServerClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
        
        // 1. Sign in with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: String(credentials.email),
          password: String(credentials.password),
        });

        if (authError || !authData.user) return null;

        // 2. Fetch profile role
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", authData.user.id)
          .single();

        if (!profile || profile.role === "PARTICIPANT") {
          // Participants should only use Google Login usually, 
          // but we can allow it if they happen to have a password.
          // However, for strictly "Admin" login, we might block PARTICIPANT role here.
          // Let's allow it for now but handle it in signIn callback.
        }

        return {
          id: authData.user.id,
          email: authData.user.email ?? undefined,
          role: (profile?.role as "PARTICIPANT" | "ORGANIZER" | "SUPER_ADMIN") ?? "PARTICIPANT",
        };
      },
    }),
  ],
  callbacks: {
    signIn: async ({ user, account, profile }) => {
      // In a real multi-tenant app, we'd check the host here.
      // Since this auth config is shared, we can implement basic gatekeeping.
      if (account?.provider === "google") {
        // Participants are allowed on main site
        return true;
      }
      
      if (account?.provider === "credentials") {
        // Admins only
        return user.role === "ORGANIZER" || user.role === "SUPER_ADMIN";
      }

      return true;
    },
    jwt: ({ token, user }) => {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as any;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
