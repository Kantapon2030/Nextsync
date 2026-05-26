// auth.config.ts
import type { NextAuthConfig } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id?: string;
    studentId: string;
    role: string;
    faceEnrolled: boolean;
  }
  interface Session {
    user: {
      id?: string;
      studentId: string;
      role: string;
      faceEnrolled: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    studentId: string;
    role: string;
    faceEnrolled: boolean;
  }
}

export const authConfig = {
  providers: [], // Configured dynamically in lib/auth.ts for Node.js
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.studentId = user.studentId;
        token.role = user.role;
        token.faceEnrolled = user.faceEnrolled;
        token.name = user.name;
      }

      // Handle dynamic session updates
      if (trigger === "update" && session) {
        if (session.faceEnrolled !== undefined) {
          token.faceEnrolled = session.faceEnrolled;
        }
        if (session.name !== undefined) {
          token.name = session.name;
        }
        if (session.role !== undefined) {
          token.role = session.role;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.studentId = token.studentId;
        session.user.role = token.role;
        session.user.faceEnrolled = token.faceEnrolled;
        session.user.name = token.name;
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
} satisfies NextAuthConfig;
