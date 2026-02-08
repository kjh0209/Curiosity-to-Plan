import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function getOrCreateUser(userId: string) {
  let user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    // Provision Gemini key for new user
    const { provisionGeminiKey } = require("./gemini-provisioner");
    let geminiKey = null;
    try {
      geminiKey = await provisionGeminiKey(userId, `${userId}@placeholder.local`);
    } catch (error) {
      console.warn("Failed to provision Gemini key for auto-created user:", error);
    }

    user = await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@placeholder.local`,  // Placeholder for anonymous users
        password: "",  // Empty password for anonymous users
        interest: "",
        goal: "",
        minutesPerDay: 20,
        streak: 0,
        geminiApiKey: geminiKey,
      },
    });
  }

  return user;
}
