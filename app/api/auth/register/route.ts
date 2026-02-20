import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
    try {
        const { email, password, name } = await req.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required" },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: "Password must be at least 6 characters" },
                { status: 400 }
            );
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: "User already exists" },
                { status: 400 }
            );
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);

        const userId = generateCuid();

        // Generate verification token
        const verificationToken = crypto.randomBytes(32).toString("hex");
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

        // Create user with verification pending
        const user = await prisma.user.create({
            data: {
                id: userId,
                email,
                password: hashedPassword,
                name: name || email.split("@")[0],
                authProvider: "credentials",
                emailVerified: false,
                emailVerificationToken: verificationToken,
                emailVerificationExpires: verificationExpires,
            },
        });

        // Send verification email (non-blocking)
        try {
            await sendVerificationEmail(user.email, verificationToken);
        } catch (err) {
            console.error("Failed to send verification email:", err);
        }

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                emailVerified: false,
            },
            message: "Account created. Please check your email to verify your account.",
            requiresVerification: true,
        });
    } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json(
            { error: "Registration failed. Please try again." },
            { status: 500 }
        );
    }
}

function generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    const counter = Math.floor(Math.random() * 1000).toString(36);
    return `c${timestamp}${randomPart}${counter}`;
}
