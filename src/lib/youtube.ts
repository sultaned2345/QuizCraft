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
    // 2. Fetch Transcript
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcriptItems || transcriptItems.length === 0) {
      throw new Error('No transcript found for this video.');
    }

    // 3. Combine text
    const transcript = transcriptItems.map(item => item.text).join(' ');

    return {
      videoId,
      title: `YouTube Video (${videoId})`, // Title scraping requires valid Google API key or separate scraper. keeping simple for now.
      transcript
    };
  } catch (error: any) {
    if (error.message?.includes('Transcript is disabled') || error.message?.includes('No transcript')) {
      throw new Error('Transcript is disabled or unavailable for this video.');
    }
    throw error;
  }
}

export function getYoutubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}`;
}