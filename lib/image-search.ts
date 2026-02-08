/**
 * Image search utility using Unsplash API
 * Free tier: 50 requests/hour
 */

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

interface UnsplashImage {
    id: string;
    urls: {
        raw: string;
        full: string;
        regular: string;
        small: string;
        thumb: string;
    };
    alt_description: string;
    user: {
        name: string;
        username: string;
    };
}

export interface ImageSearchResult {
    url: string;
    thumbnailUrl: string;
    alt: string;
    credit: string;
    creditUrl: string;
}

/**
 * Search for images using Unsplash API
 * @param query Search query
 * @param count Number of images to return (default 1)
 */
export async function searchImages(
    query: string,
    count: number = 1
): Promise<ImageSearchResult[]> {
    if (!UNSPLASH_ACCESS_KEY) {
        console.warn("UNSPLASH_ACCESS_KEY not set, returning placeholder");
        return [
            {
                url: `https://via.placeholder.com/800x600?text=${encodeURIComponent(query)}`,
                thumbnailUrl: `https://via.placeholder.com/400x300?text=${encodeURIComponent(query)}`,
                alt: query,
                credit: "Placeholder",
                creditUrl: "#",
            },
        ];
    }

    try {
        const response = await fetch(
            `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
            {
                headers: {
                    Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error(`Unsplash API error: ${response.status}`);
        }

        const data = await response.json();
        const results: ImageSearchResult[] = data.results.map((img: UnsplashImage) => ({
            url: img.urls.regular,
            thumbnailUrl: img.urls.small,
            alt: img.alt_description || query,
            credit: img.user.name,
            creditUrl: `https://unsplash.com/@${img.user.username}?utm_source=skillloop&utm_medium=referral`,
        }));

        return results.length > 0
            ? results
            : [
                {
                    url: `https://via.placeholder.com/800x600?text=${encodeURIComponent(query)}`,
                    thumbnailUrl: `https://via.placeholder.com/400x300?text=${encodeURIComponent(query)}`,
                    alt: query,
                    credit: "Placeholder",
                    creditUrl: "#",
                },
            ];
    } catch (error) {
        console.error("Image search error:", error);
        return [
            {
                url: `https://via.placeholder.com/800x600?text=${encodeURIComponent(query)}`,
                thumbnailUrl: `https://via.placeholder.com/400x300?text=${encodeURIComponent(query)}`,
                alt: query,
                credit: "Placeholder",
                creditUrl: "#",
            },
        ];
    }
}

/**
 * Get a single image for a query (convenience function)
 */
export async function getImage(query: string): Promise<ImageSearchResult> {
    const results = await searchImages(query, 1);
    return results[0];
}
