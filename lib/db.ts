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
    // Gemini key pool handles distribution automatically — no provisioning needed
    user = await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@placeholder.local`,
        password: "",
        interest: "",
        goal: "",
        minutesPerDay: 20,
        streak: 0,
      },
    });
  }

  return user;
}
