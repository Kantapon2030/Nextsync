// lib/auth.ts
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { authConfig } from "../auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        studentId: { label: "Student ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.studentId || !credentials?.password) {
          return null;
        }

        const studentId = credentials.studentId as string;
        const password = credentials.password as string;

        try {
          const userList = await db.select().from(users).where(eq(users.studentId, studentId)).limit(1);
          if (userList.length === 0) {
            return null;
          }

          const user = userList[0];
          const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
          if (!isPasswordValid) {
            return null;
          }

          // Update last login in the background
          db.update(users)
            .set({ lastLogin: new Date() })
            .where(eq(users.id, user.id))
            .catch((err: any) => console.error("Error updating last login:", err));

          return {
            id: user.id,
            studentId: user.studentId,
            name: user.displayName || user.studentId,
            role: user.role,
            faceEnrolled: user.faceEnrolled || false,
          };
        } catch (error) {
          console.error("Auth authorize error:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        // From Credentials authorize
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
  secret: process.env.NEXTAUTH_SECRET,
});
