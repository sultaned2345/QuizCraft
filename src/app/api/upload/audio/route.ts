import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/getServerSession';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import OpenAI from 'openai';

// Initialize OpenAI Client aiming at Groq's API
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY, 
  baseURL: "https://api.groq.com/openai/v1" 
});

export async function POST(req: Request) {
  try {
    // 1. Authentication Check
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Form Data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 3. Validate File Size
    // 25MB is the standard limit for Whisper API payloads
    const MAX_SIZE = 25 * 1024 * 1024; 
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 25MB (approx 30 mins).' }, 
        { status: 400 }
      );
    }

    // 4. Transcribe using Groq (distil-whisper)
    let transcriptionText = '';
    try {
      const transcription = await openai.audio.transcriptions.create({
        file: file,
        model: 'distil-whisper-large-v3-en', 
        response_format: 'text',
      });
      transcriptionText = transcription as unknown as string;
    } catch (aiError: any) {
      console.error('Groq Transcription Error:', aiError);
      return NextResponse.json(
        { error: 'Failed to transcribe audio. Please try again.' }, 
        { status: 502 }
      );
    }

    if (!transcriptionText || transcriptionText.length < 10) {
      return NextResponse.json(
        { error: 'Audio was too short or unclear to transcribe.' }, 
        { status: 400 }
      );
    }

    // 5. Upload Audio File to Supabase Storage (Optional backup)
    const fileExt = file.name.split('.').pop() || 'webm';
    const storagePath = `${session.user.id}/audio/${Date.now()}.${fileExt}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: storageError } = await supabaseAdmin.storage
      .from('documents') // Make sure this bucket exists!
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (storageError) {
      console.warn('Audio upload to storage failed, but proceeding with text:', storageError);
    }

    // 6. Create Record in 'documents' table
    // FIX: Cast insertion object to 'any' to resolve "parameter of type never" build error
    const { data: docData, error: dbError } = await supabaseAdmin
      .from('documents')
      .insert({
        user_id: session.user.id,
        file_name: file.name || 'Audio Recording',
        file_type: 'audio/transcript',
        file_size: file.size,
        storage_path: storagePath,
        extracted_text: transcriptionText,
      } as any) 
      .select('id')
      .single();

    if (dbError) {
      throw new Error(dbError.message);
    }

    // 7. Success Response
    return NextResponse.json({ 
      success: true, 
      documentId: docData.id,
      preview: transcriptionText.substring(0, 100)
    });

  } catch (error: any) {
    console.error('Audio Upload Route Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' }, 
      { status: 500 }
    );
  }
}