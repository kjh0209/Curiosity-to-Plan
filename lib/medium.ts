
import Parser from "rss-parser";

interface MediumArticle {
    title: string;
    link: string;
    creator: string;
    pubDate: string;
}

const parser = new Parser();

export async function getBestMediumArticle(tag: string): Promise<{ title: string; url: string; description: string } | null> {
    try {
        // 1. Clean tag: "React Hooks" -> "react-hooks" (Medium uses kebab-case tags)
        const cleanTag = tag.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

        // 2. Fetch RSS Feed
        const feedUrl = `https://medium.com/feed/tag/${cleanTag}`;
        const feed = await parser.parseURL(feedUrl);

        if (!feed.items || feed.items.length === 0) {
            return null;
        }

        // 3. Get the most recent article (or filter by popularity if possible, but RSS is usually chronological)
        // RSS doesn't give "claps", so we take the freshest one or a random one from top 3 to keep it fresh
        const items = feed.items.slice(0, 3);
        const best = items[0]; // Take the latest one

        return {
            title: best.title || "Medium Article",
            url: best.link || "",
            description: `By ${best.creator} • Medium`,
        };

    } catch (error) {
        console.warn(`Medium RSS fetch failed for tag: ${tag}`, error);
        return null;
    }
}
