import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Create a new ratelimiter, that allows 20 requests per 10 seconds
const ratelimit = new Ratelimit({
    redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL || "https://example.com",
        token: process.env.UPSTASH_REDIS_REST_TOKEN || "example_token",
    }),
    limiter: Ratelimit.slidingWindow(20, "10 s"),
    analytics: true,
    prefix: "@upstash/ratelimit",
});

export const config = {
    matcher: "/api/:path*",
};

export default async function middleware(request: NextRequest) {
    // Only apply to API routes
    if (!request.nextUrl.pathname.startsWith("/api")) {
        return NextResponse.next();
    }

    // Skip rate limiting if environment variables are missing (e.g. local dev without setup)
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return NextResponse.next();
    }

    // Use IP address for rate limiting
    const ip = request.headers.get("x-forwarded-for") ?? "127.0.0.1";

    try {
        const { success, limit, reset, remaining } = await ratelimit.limit(ip);

        if (!success) {
            return NextResponse.json(
                { error: "Too many requests. Please try again later." },
                {
                    status: 429,
                    headers: {
                        "X-RateLimit-Limit": limit.toString(),
                        "X-RateLimit-Remaining": remaining.toString(),
                        "X-RateLimit-Reset": reset.toString(),
                    }
                }
            );
        }

        const res = NextResponse.next();
        res.headers.set("X-RateLimit-Limit", limit.toString());
        res.headers.set("X-RateLimit-Remaining", remaining.toString());
        res.headers.set("X-RateLimit-Reset", reset.toString());
        return res;

    } catch (error) {
        console.error("Rate limiting error:", error);
        // Fail open if rate limiting service is down
        return NextResponse.next();
    }
}
