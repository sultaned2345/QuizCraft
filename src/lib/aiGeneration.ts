// src/lib/aiGeneration.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "./supabaseAdmin";
import { prisma } from "@/lib/prisma";
import { generatePodcastScript, synthesizeSpeech } from "@/lib/podcast-service";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// ------------------------------------------------------------------
// HELPER: Clean JSON
// ------------------------------------------------------------------
function cleanAndParseJSON(text: string) {
  try {
    // Remove markdown code blocks if present
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    // Find the first '{' or '[' and the last '}' or ']'
    const firstBrace = cleaned.search(/[{[]/);
    const lastBrace = cleaned.search(/[}\]]/);
    
    if (firstBrace === -1 || lastBrace === -1) {
        // Fallback: try parsing the whole string if no braces found
        return JSON.parse(cleaned);
    }
    
    const jsonString = cleaned.substring(firstBrace, lastBrace + 1);
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("JSON Parse Error:", e);
    console.error("Raw Text:", text);
    return null;
  }
}

// ------------------------------------------------------------------
// 1. QUIZ GENERATION (FIXED)
// ------------------------------------------------------------------
export async function generateQuizFromContent(
  content: string, 
  numQuestions: number = 5, 
  difficulty: string = "medium", 
  questionType: string = "MIXED"
) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  try {
    // Limit content length to avoid token limits
    const safeContent = content.substring(0, 30000);
    
    const prompt = `
      You are an expert educational content creator.
      Create a ${difficulty} difficulty quiz with ${numQuestions} questions based on the following text.
      The questions should be of type: ${questionType} (If "MIXED", use a variety of Multiple Choice, True/False, and Fill in the Blank).
      
      Text to analyze:
      "${safeContent}"
      
      Return ONLY a raw JSON array (no markdown) with this structure:
      [
        {
          "question_text": "Question?",
          "question_type": "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_IN_THE_BLANK",
          "options": ["A", "B", "C", "D"], // Include options for Multiple Choice. Null for Fill in Blank.
          "correct_answer": "The correct option string",
          "explanation": "Brief explanation"
        }
      ]
    `;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const questions = cleanAndParseJSON(response.text());

    if (!questions || !Array.isArray(questions)) return null;

    return {
      title: `Generated ${difficulty} Quiz`,
      description: "AI Generated Quiz",
      questions: questions
    };
  } catch (error) {
    console.error("Quiz Gen Error:", error);
    return null;
  }
}

// ------------------------------------------------------------------
// 2. FLASHCARD GENERATION
// ------------------------------------------------------------------
export async function generateFlashcardsFromContent(content: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    const safeContent = content.substring(0, 30000);
    
    const prompt = `
      Create 10 educational flashcards based on this text. Focus on key terms, definitions, and core concepts.
      "${safeContent}"
      
      Return ONLY a raw JSON array (no markdown) with this structure:
      [
        { "front": "Term or Question", "back": "Definition or Answer" }
      ]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const cards = cleanAndParseJSON(response.text());

    if (!cards || !Array.isArray(cards)) return null;

    return cards.map((c: any) => ({
      front_content: c.front,
      back_content: c.back,
    }));
  } catch (error) {
    console.error("Flashcard Gen Error:", error);
    return null;
  }
}

// ------------------------------------------------------------------
// 3. NOTES GENERATION
// ------------------------------------------------------------------
export async function generateNotesFromContent(content: string) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // Using Pro for better writing

  try {
    const safeContent = content.substring(0, 40000);
    
    const prompt = `
      Summarize the following text into comprehensive, structured study notes.
      Use Markdown formatting:
      - Use # Headers for main topics
      - Use bullet points for details
      - Use **bold** for key terms
      - Keep it organized and easy to read.
      
      Text to summarize:
      "${safeContent}"
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Note Gen Error:", error);
    return null;
  }
}

// ------------------------------------------------------------------
// 4. YOUTUBE GENERATION
// ------------------------------------------------------------------
export async function generateFromYoutube(videoId: string) {
    console.log("YouTube generation triggered for:", videoId);
    return null; // Placeholder
}

// ------------------------------------------------------------------
// 5. PODCAST GENERATION
// ------------------------------------------------------------------
export async function generatePodcastForDocument(
  content: string,
  title: string,
  userId: string,
  sourceId: string,
  sourceType: "document" | "note"
) {
  try {
    console.log(`🎙️ Generating Podcast for: ${title}`);

    // A. Generate Script (Host vs Expert)
    const script = await generatePodcastScript(content.substring(0, 15000));
    
    if (!script || !Array.isArray(script) || script.length === 0) {
      console.warn("Podcast script generation returned empty/invalid data.");
      return null;
    }

    // B. Synthesize Audio
    // Limiting lines for MVP speed/timeout safety
    const MAX_LINES = 12; 
    const limitedScript = script.slice(0, MAX_LINES);
    const audioBuffers: Buffer[] = [];

    for (const line of limitedScript) {
      // "Host" = Alloy (Neutral/Bright), "Expert" = Onyx (Deep/Calm)
      const voice = line.speaker === "Host" ? "alloy" : "onyx";
      try {
        const audioBuffer = await synthesizeSpeech(line.text, voice);
        audioBuffers.push(audioBuffer);
      } catch (err) {
        console.warn(`Skipping line due to TTS error: ${line.text.substring(0, 20)}...`);
      }
    }

    if (audioBuffers.length === 0) throw new Error("No audio generated");

    const combinedBuffer = Buffer.concat(audioBuffers);

    // C. Upload to Supabase Storage
    const fileName = `${userId}/${Date.now()}-podcast.mp3`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("audio") 
      .upload(fileName, combinedBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from("audio")
      .getPublicUrl(fileName);

    // D. Save to Database
    return await prisma.podcast.create({
      data: {
        userId,
        title: `Podcast: ${title}`,
        audioUrl: publicUrl,
        transcript: script as any, 
        documentId: sourceType === "document" ? sourceId : undefined,
        noteId: sourceType === "note" ? sourceId : undefined,
      },
    });

  } catch (error) {
    console.error("❌ Podcast Gen Failed:", error);
    return null; 
  }
}

// ------------------------------------------------------------------
// 6. EXPORTS (Matches route usage)
// ------------------------------------------------------------------
export const callAIToGenerateQuiz = generateQuizFromContent;
export const callAIToGenerateFlashcards = generateFlashcardsFromContent;
export const callAIToGenerateNote = generateNotesFromContent;
export async function callAIToGenerateInsights(content: string) {
    return generateNotesFromContent(content); 
}