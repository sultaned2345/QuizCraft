import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabaseAdmin'; // Uses Service Role
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 60; 

const API_KEY = process.env.GOOGLE_AI_API_KEY || "";

// Helper to interact with Gemini
async function transcribeAndSummarize(audioBase64: string, mimeType: string) {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
    Listen to this audio.
    1. Provide an accurate transcript.
    2. Provide a short summary (max 3 sentences).
    3. Generate a concise, academic title.
    
    Return JSON: { "title": "...", "transcript": "...", "summary": "..." }
    `;

    const result = await model.generateContent([
        { inlineData: { mimeType, data: audioBase64 } },
        { text: prompt }
    ]);
    const text = result.response.text();
    
    // Sanitize and parse JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse AI response");
    return JSON.parse(jsonMatch[0]);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    // 1. Check Limits
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid) {
        return NextResponse.json({ success: false, error: usageCheck.error }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const durationStr = formData.get('duration') as string; // Pass duration from client
    
    if (!file) return NextResponse.json({ success: false, error: 'No file found' }, { status: 400 });

    // 2. Prepare File
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = file.type || 'audio/webm';
    
    // 3. Upload to Supabase Storage (Persistence Layer)
    const fileExt = mimeType.split('/')[1] || 'webm';
    const uniqueName = `${user.id}/${Date.now()}-recording.${fileExt}`;
    
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from('recordings') // Make sure this bucket exists!
        .upload(uniqueName, buffer, { contentType: mimeType, upsert: false });

    if (uploadError) throw new Error(`Storage error: ${uploadError.message}`);

    // 4. Process with AI (Intelligence Layer)
    // We send base64 to Gemini because it's faster for short clips than passing a URL
    const base64Audio = buffer.toString('base64');
    const aiData = await transcribeAndSummarize(base64Audio, mimeType);

    // 5. Save to Database
    const recording = await prisma.recordings.create({
        data: {
            user_id: user.id,
            title: aiData.title,
            transcript: aiData.transcript,
            summary: aiData.summary,
            storage_path: uploadData.path, // Save the path!
            duration: parseInt(durationStr) || 0,
        }
    });

    await incrementAIGenerationUsage(user.id, 1);

    return NextResponse.json({ success: true, data: recording });

  } catch (error: any) {
    console.error("Upload Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}