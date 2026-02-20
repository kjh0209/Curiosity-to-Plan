import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

// Internal test account - bypasses registration and email verification
const TEST_ACCOUNT = {
    id: "__TEST_PRO_ACCOUNT__",
    email: "protest@skillloop.internal",
    password: "SL#9xKv2Z!Pr0Test",
    name: "Pro Tester",
};

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
        }),
        CredentialsProvider({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Invalid credentials");
                }

                // Internal test account bypass
                if (
                    credentials.email === TEST_ACCOUNT.email &&
                    credentials.password === TEST_ACCOUNT.password
                ) {
                    return {
                        id: TEST_ACCOUNT.id,
                        email: TEST_ACCOUNT.email,
                        name: TEST_ACCOUNT.name,
                    };
                }

                const user = await prisma.user.findUnique({
                    where: { email: credentials.email },
                });

                if (!user || !user.password) {
                    throw new Error("User not found");
                }

                // Check email verification for credential users
                if (!user.emailVerified && user.authProvider === "credentials") {
                    throw new Error("EMAIL_NOT_VERIFIED");
                }

                const isValid = await bcrypt.compare(credentials.password, user.password);

                if (!isValid) {
                    throw new Error("Invalid password");
                }

                return {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                };
            },
        }),
    ],
    session: {
        strategy: "jwt",
    },
    callbacks: {
        async signIn({ user, account }) {
            if (account?.provider === "google") {
                if (!user.email) return false;

                const existingUser = await prisma.user.findUnique({
                    where: { email: user.email },
                });

                if (existingUser) {
                    // Link existing account to Google if not already
                    if (existingUser.authProvider !== "google") {
                        await prisma.user.update({
                            where: { id: existingUser.id },
                            data: {
                                authProvider: "google",
                                emailVerified: true,
                            },
                        });
                    }
                    return true;
                }

                // Create new user for Google sign-in
                const timestamp = Date.now().toString(36);
                const randomPart = Math.random().toString(36).substring(2, 10);
                const userId = `c${timestamp}${randomPart}`;

                await prisma.user.create({
                    data: {
                        id: userId,
                        email: user.email,
                        password: "",
                        name: user.name || user.email.split("@")[0],
                        authProvider: "google",
                        emailVerified: true,
                    },
                });
                return true;
            }
            return true;
        },
        async jwt({ token, user, account }) {
            if (user) {
                // Internal test account bypass
                if (user.email === TEST_ACCOUNT.email) {
                    token.id = TEST_ACCOUNT.id;
                    return token;
                }

                if (account?.provider === "google") {
                    // Look up the DB user to get the cuid-based ID
                    const dbUser = await prisma.user.findUnique({
                        where: { email: user.email! },
                        select: { id: true },
                    });
                    token.id = dbUser?.id || user.id;
                } else {
                    token.id = user.id;
                }
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.id;
            }
            return session;
        },
    },
    pages: {
        signIn: "/auth/login",
    },
    secret: process.env.NEXTAUTH_SECRET || "skillloop-secret-key-change-in-production",
};
