
interface WikiResult {
    title: string;
    url: string;
    extract?: string;
}

export async function getBestWikiPage(query: string, lang: string = "en"): Promise<WikiResult | null> {
    try {
        // 1. Search for the page
        const endpoint = `https://${lang}.wikipedia.org/w/api.php`;
        const searchUrl = `${endpoint}?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;

        const response = await fetch(searchUrl);
        const data = await response.json();

        // Retry with context if no results found
        if (!data.query?.search || data.query.search.length === 0) {
            const retryUrl = `${endpoint}?action=query&list=search&srsearch=${encodeURIComponent(query + " (software)")}&format=json&origin=*`;
            const retryData = await (await fetch(retryUrl)).json();

            if (retryData.query?.search && retryData.query.search.length > 0) {
                data.query.search = retryData.query.search;
            } else {
                return null;
            }
        }

        // 2. Get the top result (avoid disambiguation)
        let topResult = data.query.search[0];

        // If title implies disambiguation, try next result
        if (topResult.title.toLowerCase().includes("disambiguation") && data.query.search.length > 1) {
            topResult = data.query.search[1];
        }
        const pageTitle = topResult.title;
        const pageUrl = `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;

        return {
            title: `Wikipedia: ${pageTitle}`,
            url: pageUrl,
            extract: topResult.snippet?.replace(/<[^>]*>/g, "") // Remove HTML tags
        };

    } catch (error) {
        console.error("Wikipedia API check error:", error);
        return null;
    }
}
