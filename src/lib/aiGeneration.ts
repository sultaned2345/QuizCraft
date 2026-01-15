// src/lib/aiGeneration.ts
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { QuestionType } from '@/types/database';
import { Prisma } from '@prisma/client';
import Groq from "groq-sdk"; 

const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// FIX: Switched to the requested model version
const AI_MODEL_NAME = "gemini-2.5-flash-lite"; 
const MAX_INPUT_LENGTH = 30000; 

if (!API_KEY) console.warn("Missing GOOGLE_AI_API_KEY");
if (!GROQ_API_KEY) console.warn("Missing GROQ_API_KEY");

const genAI = new GoogleGenerativeAI(API_KEY);
const groq = new Groq({ apiKey: GROQ_API_KEY });

// ---------------------------------------------------------------------------
// 1. QUIZ GENERATION (Structured)
// ---------------------------------------------------------------------------

type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionTypeOption = QuestionType | 'MIXED';

export async function callAIToGenerateQuiz(
  text: string,
  numQuestions: number,
  difficulty: Difficulty = 'medium',
  questionType: QuestionTypeOption = 'MIXED'
): Promise<{ title: string; questions: any[] }> {
  if (!API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY');

  const model = genAI.getGenerativeModel({
    model: AI_MODEL_NAME,
    generationConfig: {
      temperature: 0.4,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          questions: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                question_text: { type: SchemaType.STRING },
                question_type: { type: SchemaType.STRING, enum: ["MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_IN_THE_BLANK", "MATCHING"] },
                options: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
                correct_answer: { type: SchemaType.STRING },
                explanation: { type: SchemaType.STRING },
              },
              required: ["question_text", "question_type", "correct_answer", "explanation"]
            }
          }
        },
        required: ["title", "questions"]
      }
    },
  });

  const questionInfo = questionType === 'MIXED' 
    ? 'MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_THE_BLANK, MATCHING' 
    : questionType;

  const prompt = `
    Generate a ${difficulty} difficulty quiz with exactly ${numQuestions} questions.
    Question Types allowed: ${questionInfo}.
    Based ONLY on this content:
    """${text.substring(0, MAX_INPUT_LENGTH)}"""
  `;

  try {
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());

    // Sanitize for Prisma
    const questions = parsed.questions.map((q: any) => ({
      question_text: q.question_text || "Untitled Question",
      question_type: q.question_type,
      correct_answer: q.correct_answer,
      options: q.options || [],
      prompts: Prisma.JsonNull, 
      explanation: q.explanation || "",
    }));

    return { title: parsed.title || "Generated Quiz", questions };

  } catch (error: any) {
    console.error("Quiz Gen Error:", error);
    throw new Error(`AI Quiz Generation Failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// 2. NOTE GENERATION (Structured)
// ---------------------------------------------------------------------------

export async function callAIToGenerateNote(text: string): Promise<{ title: string; content: string; }> {
  if (!API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY');

  const model = genAI.getGenerativeModel({
    model: AI_MODEL_NAME,
    generationConfig: {
      temperature: 0.5,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          content: { type: SchemaType.STRING, description: "Valid HTML string with <h2>, <ul>, <p> tags" }
        },
        required: ["title", "content"]
      }
    },
  });

  const prompt = `
    Generate structured study notes (HTML format) based on the text below.
    Use <h2> for main topics, <ul> for lists, and <strong> for terms.
    Text: """${text.substring(0, MAX_INPUT_LENGTH)}"""
  `;

  try {
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    return parsed;
  } catch (error: any) {
    console.error("Note Gen Error:", error);
    throw new Error(`AI Note Generation Failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// 3. FLASHCARD GENERATION (Structured)
// ---------------------------------------------------------------------------

export async function callAIToGenerateFlashcards(text: string, numCards: number): Promise<{ front_content: string; back_content: string; }[]> {
  if (!API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY');

  const model = genAI.getGenerativeModel({
    model: AI_MODEL_NAME,
    generationConfig: {
      temperature: 0.5,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          flashcards: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                front_content: { type: SchemaType.STRING },
                back_content: { type: SchemaType.STRING },
              },
              required: ["front_content", "back_content"]
            }
          }
        }
      }
    },
  });

  const prompt = `
    Create exactly ${numCards} study flashcards from the text.
    Front: Term/Question. Back: Definition/Answer.
    Text: """${text.substring(0, MAX_INPUT_LENGTH)}"""
  `;

  try {
    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text());
    
    // Robust check for array vs object wrapper
    if (Array.isArray(parsed)) return parsed;
    if (parsed.flashcards && Array.isArray(parsed.flashcards)) return parsed.flashcards;
    return [];
  } catch (error: any) {
    console.error("Flashcard Gen Error:", error);
    throw new Error(`AI Flashcard Gen Failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// 4. AUDIO PROCESSING (Voice Notes - Groq)
// ---------------------------------------------------------------------------

export async function callAIToProcessAudio(audioFile: File): Promise<{ title: string; transcript: string; summary: string; suggestions: string[] }> {
  if (!GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY");

  // 1. Transcribe (Whisper)
  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,
    model: "distil-whisper-large-v3-en",
    response_format: "json",
    language: "en",
    temperature: 0.0,
  });

  const transcriptText = transcription.text;
  if (!transcriptText) throw new Error("Transcription failed.");

  // 2. Analyze (Llama 3)
  const systemPrompt = `You are an expert study assistant. Analyze the transcript.
  Return valid JSON:
  {
    "title": "Concise title",
    "summary": "Brief summary (max 3 sentences)",
    "suggestions": ["Action 1", "Action 2", "Action 3"]
  }`;

  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcriptText }
    ],
    model: "llama-3.3-70b-versatile", 
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  const analysisContent = completion.choices[0]?.message?.content;
  if (!analysisContent) throw new Error("Analysis failed.");

  const analysis = JSON.parse(analysisContent);

  return {
    title: analysis.title || "Untitled Recording",
    transcript: transcriptText,
    summary: analysis.summary || "No summary.",
    suggestions: analysis.suggestions || []
  };
}

// ---------------------------------------------------------------------------
// 5. INSIGHTS GENERATION (Structured)
// ---------------------------------------------------------------------------

export async function callAIToGenerateInsights(text: string): Promise<{ summary: string; key_insights: string[]; related_topics: string[] }> {
  if (!API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY');

  const model = genAI.getGenerativeModel({
    model: AI_MODEL_NAME,
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          summary: { type: SchemaType.STRING },
          key_insights: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          related_topics: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
        }
      }
    },
  });

  try {
    const result = await model.generateContent(`Analyze this text:\n"""${text.substring(0, MAX_INPUT_LENGTH)}"""`);
    return JSON.parse(result.response.text());
  } catch (error: any) {
    console.error("Insights Gen Error:", error);
    throw new Error(`AI Insights Failed: ${error.message}`);
  }
}