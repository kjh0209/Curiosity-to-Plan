
interface Article {
    title: string;
    url: string;
    description: string;
    public_reactions_count: number;
    published_at: string;
    user: {
        name: string;
        profile_image: string;
    };
}

/**
 * Search for the best tech article using Dev.to API
 * @param query - The main topic (e.g. "React", "Python")
 * @param specificDate - Optional specific term to refine
 */
export async function getBestTechArticle(query: string): Promise<{ title: string; url: string; description: string } | null> {
    try {
        // 1. Try specific tag first (e.g. "React Hooks" -> "react-hooks")
        const specificTag = query.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

        // Fetch top articles for specific tag (fetch more to filter)
        let response = await fetch(`https://dev.to/api/articles?tag=${specificTag}&top=365&per_page=5`);
        let articles: Article[] = response.ok ? await response.json() : [];

        // 2. If specific tag fails or returns empty, fallback to broad tag
        if (!articles || articles.length === 0) {
            const broadTag = query.trim().toLowerCase().split(" ")[0].replace(/[^a-z0-9]/g, "");
            if (broadTag !== specificTag) {
                const finalBroad = broadTag.endsWith("js") ? broadTag.replace("js", "") : broadTag;
                // Fetch more fallback candidates
                response = await fetch(`https://dev.to/api/articles?tag=${finalBroad}&top=365&per_page=8`);
                if (response.ok) {
                    articles = await response.json();
                }
            }
        }

        if (!articles || articles.length === 0) {
            return null;
        }

        // 3. Filter out spam AND irrelevant posts
        const spamKeywords = ["challenge", "contest", "giveaway", "price", "hackathon", "winner", "promotion", "sponsor", "course", "bootcamp"];
        const queryWords = query.toLowerCase().split(" ").filter(w => w.length > 2); // Filter out "is", "at"...

        const validArticles = articles.filter(article => {
            const titleLower = article.title.toLowerCase();

            // Spam Check
            if (spamKeywords.some(keyword => titleLower.includes(keyword))) return false;

            // Relevance Check: Title MUST contain at least one significant word from the query
            // e.g. "React Hooks" -> Title must have "react" OR "hooks" (preferably both, but strictness varies)
            // Let's be strict: It must contain the MAIN topic (first word of query usually)
            // actually, let's require at least one word match.
            const hasRelevance = queryWords.some(w => titleLower.includes(w));
            return hasRelevance;
        });

        if (validArticles.length === 0) {
            // If all are spam, fallback to the one with highest reactions anyway? 
            // Better to return the top one than nothing, or maybe just null if strict.
            // Let's return the highest rated one even if spammy as a last resort, OR stick to null.
            // User hates irrelevant content. Return null so we use Wikipedia/YouTube instead?
            // Actually, let's try to be safe.
            return null;
        }

        // 4. Return the #1 top valid article
        validArticles.sort((a, b) => b.public_reactions_count - a.public_reactions_count);

        const best = validArticles[0];
        return {
            title: best.title,
            url: best.url,
            description: `${best.user.name} • ${best.public_reactions_count} reactions • Dev.to`,
        };

    } catch (error) {
        console.warn("Dev.to API error:", error);
        return null;
    }
}
