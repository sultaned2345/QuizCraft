import { NextResponse } from "next/server";
import { generatePodcastScript, synthesizeSpeech } from "@/lib/podcast-service";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/getServerSession"; // Assuming you have this helper
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase Admin for storage upload
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { content, title, sourceId, sourceType } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    // 1. Generate Script
    const script = await generatePodcastScript(content);

    // 2. Synthesize Audio (Sequentially to stitch logic)
    // In a real app, we might use ffmpeg to stitch. 
    // Here, to keep it pure JS/Next, we will generate one buffer by concatenating (simple approach) 
    // or upload multiple files. Let's try simple buffer concatenation for MP3s (works reasonably well).
    
    const audioBuffers: Buffer[] = [];
    
    // Limit script length for timeout safety in MVP
    const limitedScript = script.slice(0, 10); 

    for (const line of limitedScript) {
      const voice = line.speaker === "Host" ? "alloy" : "onyx";
      const audioBuffer = await synthesizeSpeech(line.text, voice);
      audioBuffers.push(audioBuffer);
    }

    const combinedBuffer = Buffer.concat(audioBuffers);

    // 3. Upload to Supabase Storage
    const fileName = `${session.user.id}/${Date.now()}-podcast.mp3`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("podcasts")
      .upload(fileName, combinedBuffer, {
        contentType: "audio/mpeg",
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("podcasts")
      .getPublicUrl(fileName);

    // 4. Save to Database
    const podcast = await prisma.podcast.create({
      data: {
        userId: session.user.id,
        title: title || "Generated Podcast",
        audioUrl: publicUrl,
        transcript: script as any, // Cast JSON
        documentId: sourceType === 'document' ? sourceId : undefined,
        noteId: sourceType === 'note' ? sourceId : undefined,
      },
    });

    return NextResponse.json(podcast);

  } catch (error) {
    console.error("Podcast Generation Error:", error);
    return NextResponse.json(
      { error: "Failed to generate podcast", details: (error as Error).message },
      { status: 500 }
    );
  }
}