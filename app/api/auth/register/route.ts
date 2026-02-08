import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { provisionGeminiKey } from "@/lib/gemini-provisioner";

export async function POST(req: NextRequest) {
    try {
        const {
            email,
            password,
            name,
            openaiApiKey,
            openaiModel,
            openaiDailyQuota
        } = await req.json();

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

        // Generate a unique ID for the user first (for Gemini key provisioning)
        const userId = generateCuid();

        // Prepare user data
        const userData: any = {
            id: userId,
            email,
            password: hashedPassword,
            name: name || email.split("@")[0],
        };

        // Add OpenAI settings if provided
        if (openaiApiKey) {
            // User provided their own OpenAI key
            userData.openaiApiKey = openaiApiKey;
            if (openaiModel) {
                userData.openaiModel = openaiModel;
            }
            if (openaiDailyQuota) {
                userData.openaiDailyQuota = parseInt(openaiDailyQuota, 10);
            }
        } else {
            // No OpenAI key provided - provision a Gemini key for this user
            try {
                const geminiKey = await provisionGeminiKey(userId, email);
                userData.geminiApiKey = geminiKey;
            } catch (geminiError) {
                console.warn("Failed to provision Gemini key, using shared key:", geminiError);
                // Continue without a user-specific key - will use shared key
            }
        }

        // Create user
        const user = await prisma.user.create({
            data: userData,
        });

        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                hasOpenAiKey: !!openaiApiKey,
                hasGeminiKey: !!user.geminiApiKey,
            },
        });
    } catch (error) {
        console.error("Registration error:", error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}

// Simple CUID generator (similar to Prisma's)
function generateCuid(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substring(2, 10);
    const counter = Math.floor(Math.random() * 1000).toString(36);
    return `c${timestamp}${randomPart}${counter}`;
}
