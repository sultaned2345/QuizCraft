// src/lib/aiGeneration.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabaseAdmin } from "./supabaseAdmin";
import { prisma } from "@/lib/prisma";
import { generatePodcastScript, synthesizeSpeech } from "@/lib/podcast-service";
import { fetchYoutubeTranscript } from "./youtube"; 

// Use GOOGLE_AI_API_KEY as primary, with fallback to GEMINI_API_KEY
const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || "";

if (!apiKey) {
  console.warn("⚠️ NO GOOGLE AI API KEY FOUND. Quiz generation will fail.");
}

const genAI = new GoogleGenerativeAI(apiKey);

// ------------------------------------------------------------------
// HELPER: Model Fallback Logic
// ------------------------------------------------------------------
async function generateWithFallback(
  preferredModelName: string, 
  prompt: string,
  fallbackModelName: string = "gemini-1.5-flash"
) {
  try {
    // Try primary model
    const model = genAI.getGenerativeModel({ model: preferredModelName });
    const result = await model.generateContent(prompt);
    return await result.response;
  } catch (error: any) {
    // If 404 (Model Not Found) or 400 (Bad Request), try fallback
    if (error.message?.includes("404") || error.message?.includes("not found")) {
      console.warn(`⚠️ Model ${preferredModelName} not found. Falling back to ${fallbackModelName}.`);
      const fallback = genAI.getGenerativeModel({ model: fallbackModelName });
      const result = await fallback.generateContent(prompt);
      return await result.response;
    }
    throw error;
  }
}

// ------------------------------------------------------------------
// HELPER: Clean JSON
// ------------------------------------------------------------------
function cleanAndParseJSON(text: string) {
  try {
    // 1. Remove markdown code blocks
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();

    // 2. Find the FIRST opening brace/bracket
    const firstBrace = cleaned.search(/[{[]/);

    // 3. Find the LAST closing brace/bracket
    const lastCurly = cleaned.lastIndexOf('}');
    const lastSquare = cleaned.lastIndexOf(']');
    const lastBrace = Math.max(lastCurly, lastSquare);

    if (firstBrace === -1 || lastBrace === -1) {
      return JSON.parse(cleaned);
    }

    // Extract the complete JSON substring
    const jsonString = cleaned.substring(firstBrace, lastBrace + 1);
    return JSON.parse(jsonString);
  } catch (e) {
    console.error("JSON Parse Error:", e);
    console.error("Raw Text:", text);
    return null;
  }
}

// ------------------------------------------------------------------
// 1. QUIZ GENERATION (FROM CONTENT)
// ------------------------------------------------------------------
export async function generateQuizFromContent(
  content: string, 
  numQuestions: number = 5, 
  difficulty: string = "medium", 
  questionType: string = "MIXED"
) {
  try {
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
    
    const response = await generateWithFallback("gemini-2.5-flash-lite", prompt, "gemini-1.5-flash");
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
// 1.5 TOPIC QUIZ GENERATION (NEW - For Weakness Slayer)
// ------------------------------------------------------------------
export async function generateQuizFromTopic(
  topic: string, 
  numQuestions: number = 5, 
  difficulty: string = "medium", 
  questionType: string = "MIXED"
) {
  try {
    const prompt = `
      You are a strict teacher creating a test to verify mastery of a specific topic.
      Topic: "${topic}"
      
      Create ${numQuestions} ${difficulty} level questions about this topic.
      Question Types: ${questionType} (If "MIXED", vary the types).
      
      Focus on core concepts, common misconceptions, and critical thinking.
      
      Return ONLY a raw JSON array (no markdown) with this structure:
      [
        {
          "question_text": "Question?",
          "question_type": "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_IN_THE_BLANK",
          "options": ["A", "B", "C", "D"],
          "correct_answer": "The correct option string",
          "explanation": "Brief explanation"
        }
      ]
    `;
    
    // Using a smart model for creative topic generation
    const response = await generateWithFallback("gemini-2.5-flash-lite", prompt, "gemini-1.5-flash");
    const questions = cleanAndParseJSON(response.text());

    if (!questions || !Array.isArray(questions)) return null;

    return {
      title: `Practice: ${topic}`,
      questions: questions
    };
  } catch (error) {
    console.error("Topic Quiz Gen Error:", error);
    return null;
  }
}

// ------------------------------------------------------------------
// 2. FLASHCARD GENERATION
// ------------------------------------------------------------------
export async function generateFlashcardsFromContent(content: string, numCards: number = 10) {
  try {
    const safeContent = content.substring(0, 30000);
    const prompt = `
      Create ${numCards} educational flashcards based on this text. Focus on key terms, definitions, and core concepts.
      "${safeContent}"
      
      Return ONLY a raw JSON array (no markdown) with this structure:
      [
        { "front": "Term or Question", "back": "Definition or Answer" }
      ]
    `;

    const response = await generateWithFallback("gemini-2.5-flash-lite", prompt, "gemini-1.5-flash");
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

    const response = await generateWithFallback("gemini-2.5-flash-lite", prompt, "gemini-1.5-pro");
    return response.text();
  } catch (error) {
    console.error("Note Gen Error:", error);
    return null;
  }
}

// ------------------------------------------------------------------
// 4. INSIGHTS GENERATION
// ------------------------------------------------------------------
export async function generateInsightsFromContent(content: string) {
  try {
    const safeContent = content.substring(0, 30000);
    const prompt = `
      Analyze the following text and extract key learning insights.
      Text: "${safeContent}"
      
      Return ONLY a raw JSON object with this exact structure:
      {
        "keyConcepts": ["concept 1", "concept 2", ...],
        "examQuestions": ["question 1", "question 2", ...],
        "mainArguments": ["argument 1", "argument 2", ...]
      }
    `;

    const response = await generateWithFallback("gemini-2.5-flash-lite", prompt, "gemini-1.5-flash");
    const json = cleanAndParseJSON(response.text());
    
    if (!json || !Array.isArray(json.keyConcepts)) return null;
    return json;
  } catch (error) {
    console.error("Insights Gen Error:", error);
    return null;
  }
}

// ------------------------------------------------------------------
// 5. CHAT RESPONSE
// ------------------------------------------------------------------
export async function generateChatResponse(context: string, query: string, history: any[] = []) {
  try {
     const safeContext = context.substring(0, 25000); // Token limit safety
     const prompt = `
      You are a helpful AI tutor assisting a student with a video.
      Use the provided video transcript to answer the student's question accurately.
      
      Transcript Context:
      "${safeContext}"

      Student Question: "${query}"
      
      Answer concisely and clearly.
     `;
     const response = await generateWithFallback("gemini-1.5-flash", prompt);
     return response.text();
  } catch (error) {
    console.error("Chat Gen Error:", error);
    return "I'm having trouble analyzing the video right now.";
  }
}

// ------------------------------------------------------------------
// 6. MASTER ORCHESTRATOR (The "Turbo" Function)
// ------------------------------------------------------------------
export async function generateFromYoutube(videoUrlOrId: string) {
    console.log("🚀 Turbo Generation for:", videoUrlOrId);
    
    // 1. Fetch Full Transcript (and Title)
    // This uses the robust fetcher from src/lib/youtube.ts
    const { videoId, title, transcript } = await fetchYoutubeTranscript(videoUrlOrId);

    if (!transcript) throw new Error("Could not retrieve transcript.");

    // 2. Generate Everything Else in Parallel
    // We generate Notes, Flashcards, Quiz, and Insights all at once for speed
    const [notes, flashcards, quiz, insights] = await Promise.all([
        generateNotesFromContent(transcript),
        generateFlashcardsFromContent(transcript, 10),
        generateQuizFromContent(transcript, 5, 'medium', 'MIXED'),
        generateInsightsFromContent(transcript)
    ]);

    // 3. Return Bundle
    return {
        videoId,
        title,
        fullText: transcript, // The raw transcript for the UI
        notes,
        flashcards,
        quiz,
        insights
    };
}

// ------------------------------------------------------------------
// 7. PODCAST GENERATION
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
    const MAX_LINES = 12; 
    const limitedScript = script.slice(0, MAX_LINES);
    const audioBuffers: Buffer[] = [];

    for (const line of limitedScript) {
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
    return await prisma.recordings.create({
      data: {
        user_id: userId,
        title: `Podcast: ${title}`,
        transcript: JSON.stringify(script), 
        suggestions: { audioUrl: publicUrl }, 
        summary: "Generated by QuizCraft AI",
      },
    });

  } catch (error) {
    console.error("❌ Podcast Gen Failed:", error);
    return null; 
  }
}

// ------------------------------------------------------------------
// 8. EXPORTS
// ------------------------------------------------------------------
export const callAIToGenerateQuiz = generateQuizFromContent;
export const callAIToGenerateQuizFromTopic = generateQuizFromTopic; // <--- NEW EXPORT
export const callAIToGenerateFlashcards = generateFlashcardsFromContent;
export const callAIToGenerateNote = generateNotesFromContent;
export const callAIToGenerateInsights = generateInsightsFromContent;
export const callAIToGenerateChat = generateChatResponse;