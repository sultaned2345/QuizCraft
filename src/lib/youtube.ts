// src/lib/youtube.ts
import { YoutubeTranscript } from 'youtube-transcript';

export interface YouTubeVideoData {
  videoId: string;
  title: string;
  transcript: string;
}

export async function fetchYoutubeTranscript(videoUrl: string): Promise<YouTubeVideoData> {
  // 1. Extract Video ID
  const videoIdMatch = videoUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  const videoId = videoIdMatch ? videoIdMatch[1] : null;

  if (!videoId) {
    throw new Error('Invalid YouTube URL');
  }

  try {
    // Attempt 1: Try the standard library
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);
    
    if (transcriptItems && transcriptItems.length > 0) {
        return {
            videoId,
            title: `YouTube Video (${videoId})`,
            transcript: transcriptItems.map(item => item.text).join(' ')
        };
    }
    
    throw new Error('Library returned empty transcript');

  } catch (error: any) {
    console.warn(`[YouTube Lib Failed]: ${error.message}. Attempting fallback...`);
    
    // Attempt 2: Custom Fallback (Robust against Vercel/IP blocks)
    try {
        return await fetchTranscriptFallback(videoId);
    } catch (fallbackError: any) {
        console.error(`[YouTube Fallback Failed]:`, fallbackError);
        throw new Error('Transcript is disabled or unavailable for this video.');
    }
  }
}

// --- FALLBACK IMPLEMENTATION ---
async function fetchTranscriptFallback(videoId: string): Promise<YouTubeVideoData> {
    // 1. Fetch Video Page with "Browser" Headers
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        }
    });
    
    const html = await res.text();

    // 2. Extract CaptionTracks JSON
    const captionsRegex = /"captionTracks":(\[.*?\])/;
    const match = html.match(captionsRegex);

    if (!match || !match[1]) {
        throw new Error('No caption tracks found in page source');
    }

    const captionTracks = JSON.parse(match[1]);
    if (!captionTracks.length) {
        throw new Error('Caption tracks list is empty');
    }

    // 3. Select Track: Prefer English, then Arabic, otherwise first available
    // (This helps with the Arabic video issue you encountered)
    const track = captionTracks.find((t: any) => t.languageCode === 'en') || 
                  captionTracks.find((t: any) => t.languageCode === 'ar') || 
                  captionTracks[0];

    // 4. Fetch the actual XML transcript
    const transcriptRes = await fetch(track.baseUrl);
    const transcriptXml = await transcriptRes.text();

    // 5. Parse XML (Simple regex to avoid heavy XML parser deps)
    const textSegments = transcriptXml.match(/<text[^>]*>(.*?)<\/text>/g);
    
    if (!textSegments) {
        throw new Error('Failed to parse transcript XML');
    }

    const cleanText = textSegments
        .map(tag => tag.replace(/<[^>]+>/g, '').replace(/&amp;#39;/g, "'").replace(/&amp;quot;/g, '"'))
        .join(' ');

    // Extract Title if possible
    const titleMatch = html.match(/<title>(.*?) - YouTube<\/title>/);
    const title = titleMatch ? titleMatch[1] : `YouTube Video (${videoId})`;

    return {
        videoId,
        title,
        transcript: cleanText
    };
}

export function getYoutubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}