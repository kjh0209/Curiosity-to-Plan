// YouTube Data API v3 integration
// Requires YOUTUBE_API_KEY in .env.local
// Get your API key from: https://console.cloud.google.com/apis/credentials

interface YouTubeVideo {
    videoId: string;
    title: string;
    channelTitle: string;
    thumbnail: string;
    viewCount?: string;
    duration?: string;       // Formatted duration like "5:30"
    durationMinutes?: number; // Duration in minutes for time tracking
    url: string;
}

interface YouTubeSearchResult {
    videos: YouTubeVideo[];
    error?: string;
}

type SortOrder = "relevance" | "viewCount" | "rating" | "date";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * Search YouTube for videos and return the top result
 * @param query - Search query
 * @param language - Language code (en, ko, ja, etc.)
 * @param order - Sort order (relevance, viewCount, rating, date)
 * @param maxResults - Number of results to return
 */
export async function searchYouTubeVideos(
    query: string,
    language: string = "en",
    order: SortOrder = "relevance",
    maxResults: number = 3,
    maxDurationMinutes?: number  // Filter out videos longer than this
): Promise<YouTubeSearchResult> {
    if (!YOUTUBE_API_KEY) {
        console.warn("YOUTUBE_API_KEY not set, returning search URL fallback");
        return {
            videos: [{
                videoId: "",
                title: `Search: ${query}`,
                channelTitle: "YouTube",
                thumbnail: "",
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=CAMSAhAB`,
            }],
            error: "API key not configured",
        };
    }

    try {
        // Map language code to region code
        const regionMap: Record<string, string> = {
            ko: "KR",
            ja: "JP",
            zh: "CN",
            es: "ES",
            fr: "FR",
            de: "DE",
            en: "US",
        };
        const regionCode = regionMap[language] || "US";

        // Search for videos
        const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
        searchUrl.searchParams.set("part", "snippet");
        searchUrl.searchParams.set("q", query);
        searchUrl.searchParams.set("type", "video");
        searchUrl.searchParams.set("order", order);
        searchUrl.searchParams.set("maxResults", maxResults.toString());
        searchUrl.searchParams.set("regionCode", regionCode);
        searchUrl.searchParams.set("relevanceLanguage", language);
        searchUrl.searchParams.set("key", YOUTUBE_API_KEY);

        const searchResponse = await fetch(searchUrl.toString());

        if (!searchResponse.ok) {
            const errorData = await searchResponse.json();
            console.error("YouTube API error:", errorData);
            throw new Error(errorData.error?.message || "YouTube API error");
        }

        const searchData = await searchResponse.json();

        if (!searchData.items || searchData.items.length === 0) {
            return { videos: [], error: "No videos found" };
        }

        // Get video statistics and duration
        const videoIds = searchData.items.map((item: any) => item.id.videoId).join(",");
        const statsUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
        statsUrl.searchParams.set("part", "statistics,contentDetails");
        statsUrl.searchParams.set("id", videoIds);
        statsUrl.searchParams.set("key", YOUTUBE_API_KEY);

        const statsResponse = await fetch(statsUrl.toString());
        const statsData = statsResponse.ok ? await statsResponse.json() : { items: [] };

        // Build video objects
        let videos: YouTubeVideo[] = searchData.items.map((item: any, idx: number) => {
            const stats = statsData.items?.[idx]?.statistics || {};
            const contentDetails = statsData.items?.[idx]?.contentDetails || {};
            const { duration, durationMinutes } = parseDuration(contentDetails.duration);

            return {
                videoId: item.id.videoId,
                title: item.snippet.title,
                channelTitle: item.snippet.channelTitle,
                thumbnail: item.snippet.thumbnails?.medium?.url || "",
                viewCount: stats.viewCount ? formatViewCount(parseInt(stats.viewCount)) : undefined,
                duration,
                durationMinutes,
                url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            };
        });

        // Filter by max duration if specified
        if (maxDurationMinutes && maxDurationMinutes > 0) {
            const originalCount = videos.length;
            videos = videos.filter(v => !v.durationMinutes || v.durationMinutes <= maxDurationMinutes);
            console.log(`[YouTube] Filtered ${originalCount - videos.length} videos exceeding ${maxDurationMinutes} min`);
        }

        return { videos };
    } catch (error) {
        console.error("YouTube search error:", error);
        // Fallback to search URL
        return {
            videos: [{
                videoId: "",
                title: `Search: ${query}`,
                channelTitle: "YouTube",
                thumbnail: "",
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=CAMSAhAB`,
            }],
            error: String(error),
        };
    }
}

/**
 * Get a single best video for a topic
 */
export async function getBestYouTubeVideo(
    topic: string,
    interest: string,
    language: string = "en",
    sortBy: SortOrder = "relevance"
): Promise<YouTubeVideo | null> {
    const query = `${topic} ${interest} tutorial`;
    const result = await searchYouTubeVideos(query, language, sortBy, 1);
    return result.videos[0] || null;
}

function formatViewCount(count: number): string {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M views`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K views`;
    return `${count} views`;
}

/**
 * Parse YouTube ISO 8601 duration format (PT#H#M#S) to readable string and minutes
 */
function parseDuration(isoDuration: string | undefined): { duration?: string; durationMinutes?: number } {
    if (!isoDuration) return {};

    // Parse ISO 8601 duration: PT1H30M45S
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return {};

    const hours = parseInt(match[1] || "0");
    const minutes = parseInt(match[2] || "0");
    const seconds = parseInt(match[3] || "0");

    const totalMinutes = hours * 60 + minutes + seconds / 60;

    let duration: string;
    if (hours > 0) {
        duration = `${hours}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    } else {
        duration = `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    return { duration, durationMinutes: Math.round(totalMinutes * 10) / 10 };
}
