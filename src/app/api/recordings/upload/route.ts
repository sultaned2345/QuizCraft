import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { ApiResponse } from '@/types/database';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow 60s for processing

const API_KEY = process.env.GOOGLE_AI_API_KEY || "";

async function transcribeAndSummarize(audioBase64: string, mimeType: string) {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
    Listen to this audio. 
    1. Provide an accurate transcript.
    2. Provide a short summary.
    3. Generate a concise title.
    
    Return JSON: { "title": "...", "transcript": "...", "summary": "..." }
    `;

    const result = await model.generateContent([
        { inlineData: { mimeType, data: audioBase64 } },
        { text: prompt }
    ]);
    const response = await result.response;
    const text = response.text();
    
    // Parse JSON safely
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Failed to parse AI response");
    return JSON.parse(jsonMatch[0]);
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    const usageCheck = await checkAIGenerationUsageLimit(user.id);
    if (!usageCheck.isValid) return NextResponse.json({ success: false, error: usageCheck.error }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ success: false, error: 'No file found' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Audio = buffer.toString('base64');
    const mimeType = file.type || 'audio/webm';

    const aiData = await transcribeAndSummarize(base64Audio, mimeType);

    const recording = await prisma.recordings.create({
        data: {
            user_id: user.id,
            title: aiData.title,
            transcript: aiData.transcript,
            summary: aiData.summary,
        }
    });

    await incrementAIGenerationUsage(user.id, 1);

    return NextResponse.json<ApiResponse>({ success: true, data: recording });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}