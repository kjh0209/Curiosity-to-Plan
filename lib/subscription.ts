import { prisma } from "./db";

// Internal test account ID - always treated as pro with no daily limits
const TEST_ACCOUNT_ID = "__TEST_PRO_ACCOUNT__";

export type SubscriptionTier = "free" | "pro";

export interface TierLimits {
  maxPlansPerDay: number;
  maxDaysOpenedPerDay: number;
  geminiMonthlyTokenLimit: number;
  useServerOpenAI: boolean;
  openaiModel: string;
}

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    maxPlansPerDay: 3,
    maxDaysOpenedPerDay: 1,
    geminiMonthlyTokenLimit: 7_000,
    useServerOpenAI: false,
    openaiModel: "",
  },
  pro: {
    maxPlansPerDay: 5,
    maxDaysOpenedPerDay: 3,
    geminiMonthlyTokenLimit: 3_000_000,
    useServerOpenAI: true,
    openaiModel: "gpt-4o-mini",
  },
};

export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return TIER_LIMITS[tier] || TIER_LIMITS.free;
}

export async function getUserTier(userId: string): Promise<SubscriptionTier> {
  if (userId === TEST_ACCOUNT_ID) return "pro";

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true, subscriptionStatus: true, subscriptionEnd: true },
  });
  if (!user) return "free";
  if (user.subscriptionTier === "pro" && user.subscriptionStatus === "active") {
    if (user.subscriptionEnd && new Date(user.subscriptionEnd) < new Date()) {
      return "free";
    }
    return "pro";
  }
  return "free";
}

async function checkAndResetDailyCounters(userId: string): Promise<{
  plansCreatedToday: number;
  daysOpenedToday: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plansCreatedToday: true, daysOpenedToday: true, lastDailyReset: true },
  });
  if (!user) throw new Error("User not found");

  const now = new Date();
  const lastReset = new Date(user.lastDailyReset);
  const isNewDay = now.toDateString() !== lastReset.toDateString();

  if (isNewDay) {
    await prisma.user.update({
      where: { id: userId },
      data: { plansCreatedToday: 0, daysOpenedToday: 0, lastDailyReset: now },
    });
    return { plansCreatedToday: 0, daysOpenedToday: 0 };
  }

  return { plansCreatedToday: user.plansCreatedToday, daysOpenedToday: user.daysOpenedToday };
}

export async function canCreatePlan(userId: string): Promise<{
  allowed: boolean;
  tier: SubscriptionTier;
  remaining: number;
  total: number;
}> {
  if (userId === TEST_ACCOUNT_ID) {
    return { allowed: true, tier: "pro", remaining: 99, total: 99 };
  }
  const tier = await getUserTier(userId);
  const limits = getTierLimits(tier);
  const { plansCreatedToday } = await checkAndResetDailyCounters(userId);

  return {
    allowed: plansCreatedToday < limits.maxPlansPerDay,
    tier,
    remaining: Math.max(0, limits.maxPlansPerDay - plansCreatedToday),
    total: limits.maxPlansPerDay,
  };
}

export async function canOpenDay(userId: string): Promise<{
  allowed: boolean;
  tier: SubscriptionTier;
  remaining: number;
  total: number;
}> {
  if (userId === TEST_ACCOUNT_ID) {
    return { allowed: true, tier: "pro", remaining: 99, total: 99 };
  }
  const tier = await getUserTier(userId);
  const limits = getTierLimits(tier);
  const { daysOpenedToday } = await checkAndResetDailyCounters(userId);

  return {
    allowed: daysOpenedToday < limits.maxDaysOpenedPerDay,
    tier,
    remaining: Math.max(0, limits.maxDaysOpenedPerDay - daysOpenedToday),
    total: limits.maxDaysOpenedPerDay,
  };
}

export async function incrementPlanCount(userId: string): Promise<void> {
  if (userId === TEST_ACCOUNT_ID) return;
  await prisma.user.update({
    where: { id: userId },
    data: { plansCreatedToday: { increment: 1 } },
  });
}

export async function incrementDayOpenCount(userId: string): Promise<void> {
  if (userId === TEST_ACCOUNT_ID) return;
  await prisma.user.update({
    where: { id: userId },
    data: { daysOpenedToday: { increment: 1 } },
  });
}
