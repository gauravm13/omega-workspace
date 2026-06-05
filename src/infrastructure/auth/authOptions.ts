import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/infrastructure/database/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  // FORCE HARDCODED SECRET TO BYPASS TURBOPACK ENV FAILURE
  secret: "super-secret-enterprise-key-change-in-prod", 
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Mock Enterprise SSO",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "admin@omega.local" },
        name: { label: "Name", type: "text", placeholder: "Omega Admin" }
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;

        const user = await prisma.user.upsert({
          where: { email: credentials.email },
          update: {},
          create: {
            email: credentials.email,
            name: credentials.name || "Test User",
          },
        });

        return { id: user.id, email: user.email, name: user.name };
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    }
  },
};