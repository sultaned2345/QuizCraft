// src/lib/aiGeneration.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Question, QuestionType } from '@/types/database';
import { Prisma } from '@prisma/client';
import Groq from "groq-sdk"; 
import fs from 'fs'; // Required for server-side file streaming

const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// --- UPDATED: Use the Flash-Lite model for speed and cost-efficiency ---
const AI_MODEL_NAME = "gemini-2.5-flash-lite"; 

// --- UPDATED: Increased input length to ~100k characters (~25k tokens) ---
const MAX_INPUT_LENGTH = 100000; 

if (!API_KEY) {
    console.warn("Missing GOOGLE_AI_API_KEY environment variable. AI generation will fail.");
}

if (!GROQ_API_KEY) {
    console.warn("Missing GROQ_API_KEY environment variable. Voice notes will fail.");
}

const genAI = new GoogleGenerativeAI(API_KEY);
const groq = new Groq({ apiKey: GROQ_API_KEY });

/**
 * Strips HTML tags and checks if the remaining text is meaningful.
 */
function isContentMeaningful(content: string): boolean {
    if (!content) return false;
    const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 20; 
}

// ---------------------------------------------------------------------------
// 1. QUIZ GENERATION
// ---------------------------------------------------------------------------

type Difficulty = 'easy' | 'medium' | 'hard';
type QuestionTypeOption = QuestionType | 'MIXED';

function buildQuizPrompt({
  text,
  numQuestions,
  difficulty,
  questionType,
}: {
  text: string;
  numQuestions: number;
  difficulty: Difficulty;
  questionType: QuestionTypeOption;
}) {
  const questionTypes =
    questionType === 'MIXED'
      ? 'MULTIPLE_CHOICE, TRUE_FALSE, FILL_IN_THE_BLANK, and MATCHING'
      : questionType;

  const system = `You are an expert quiz creator. Based ONLY on the provided text, generate exactly ${numQuestions} ${difficulty} difficulty ${questionTypes} questions. Focus on the most important concepts and information in the text. For each question, provide a brief explanation for the correct answer derived strictly from the text.`;

  const user = `Generate ${numQuestions} ${difficulty} difficulty quiz questions of the following type(s): ${questionTypes}, based *only* on the content below.

Content:
"""
${text}
"""

Return ONLY valid JSON with this exact shape:
{
  "title": "string", // a concise quiz title based on the content
  "questions": [
    {
      "question_text": "string",
      "question_type": "MULTIPLE_CHOICE",
      "options": ["string", "string", "string", "string"],
      "correct_answer": "string",
      "explanation": "string"
    },
    {
      "question_text": "string",
      "question_type": "TRUE_FALSE",
      "correct_answer": "True" | "False",
      "explanation": "string"
    },
    {
      "question_text": "string", // use "____" for the blank(s)
      "question_type": "FILL_IN_THE_BLANK",
      "options": ["string"], // An array of one or more acceptable answers
      "correct_answer": "N/A", // Not used, options array is used
      "explanation": "string"
    },
    {
      "question_text": "Match the following items:",
      "question_type": "MATCHING",
      "prompts": ["Prompt 1", "Prompt 2", "Prompt 3"],
      "options": ["Answer 1", "Answer 2", "Answer 3"], // Corresponding answers in order
      "correct_answer": "N/A",
      "explanation": "Explanation of how the items are related."
    }
  ]
}`;
  return `${system}\n\n${user}`;
}

export async function callAIToGenerateQuiz(
  text: string,
  numQuestions: number,
  difficulty: Difficulty = 'medium',
  questionType: QuestionTypeOption = 'MIXED'
): Promise<{ title: string; questions: any[] }> {
  if (!API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY environment variable');

  const model = genAI.getGenerativeModel({
    model: AI_MODEL_NAME,
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json',
    },
  });

  const textSnippet = text.substring(0, MAX_INPUT_LENGTH);
  const prompt = buildQuizPrompt({ text: textSnippet, numQuestions, difficulty, questionType });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const content = response.text();

  if (!content) throw new Error('Empty response from Gemini');

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (parseError) {
    console.error("Failed to parse AI response, trying fallback...", content.substring(0, 500));
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); }
      catch (fallbackError) { throw new Error(`Invalid JSON structure, even after fallback.`); }
    } else {
      throw new Error(`Invalid JSON structure. No JSON object found.`);
    }
  }

  if (!parsed || !parsed.title || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('Gemini returned invalid or empty data structure (missing title or questions array).');
  }

  const sanitizedQuestions = parsed.questions.map((q: any) => ({
    question_text: q.question_text || "Untitled Question",
    question_type: q.question_type || "MULTIPLE_CHOICE",
    correct_answer: q.correct_answer || "",
    options: Array.isArray(q.options) ? q.options : (q.question_type === 'TRUE_FALSE' ? ["True", "False"] : Prisma.JsonNull),
    prompts: Array.isArray(q.prompts) ? q.prompts : Prisma.JsonNull,
    explanation: q.explanation || "",
  }));

  return { title: parsed.title, questions: sanitizedQuestions };
}

// ---------------------------------------------------------------------------
// 2. NOTE GENERATION (TURBO-CHARGED)
// ---------------------------------------------------------------------------

function buildNotePrompt({ text }: { text: string }): string {
  return `You are a "Turbo" AI Study Assistant. Transform the following content into a high-quality, visually engaging study guide.

You MUST format the notes as clean, semantic HTML.
Rules for formatting:
- **Emojis:** Use relevant emojis for section headers and key points to make the notes skimmable (e.g., 💡 for ideas, ⚠️ for warnings, 🔑 for key terms).
- **Structure:**
  1. **🎯 Executive Summary:** A 2-3 sentence high-level overview.
  2. **🔑 Core Concepts:** The main ideas, formatted as bullet points.
  3. **📘 Detailed Breakdown:** Deep dive into the content. Use <h3> for sub-topics.
  4. **📊 Comparisons (Optional):** If the text compares two things, use an HTML <table>.
  5. **📖 Glossary:** A definition list of complex terms used in the text.
  6. **🚀 Actionable Takeaways:** Practical applications or summary points.
- **Tags:**
  - Use <h2> for main section headers (with emojis).
  - Use <h3> for sub-sections.
  - Use <ul>/<ol> and <li> for lists.
  - Use <strong> for emphasis.
  - Use <blockquote> for very important quotes or "Remember this" callouts.
  - Use <table>, <tr>, <th>, <td> for data/comparisons (add border classes if needed, but keep it semantic).
- Do NOT use Markdown (no #, *, -).
- Do NOT use <html>, <body>, or <head> tags.

Content:
"""
${text}
"""

Return ONLY valid JSON in this exact shape. The "content" field MUST be a valid HTML string.

{
  "notes": [
    {
      "title": "A Concise & Catchy Title",
      "content": "<h2>🎯 Executive Summary</h2><p>...</p><h2>🔑 Core Concepts</h2><ul><li><strong>Concept A:</strong> ...</li></ul>..."
    }
  ]
}`;
}

export async function callAIToGenerateNote(text: string): Promise<{ title: string; content: string; }> {
  if (!API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY environment variable');

  const model = genAI.getGenerativeModel({
    model: AI_MODEL_NAME,
    generationConfig: {
      temperature: 0.6, // Slightly higher for more creative/natural study guide flow
      responseMimeType: "application/json",
    },
  });

  const textSnippet = text.substring(0, MAX_INPUT_LENGTH);
  const prompt = buildNotePrompt({ text: textSnippet });

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const content = response.text();
  
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (parseError) {
    console.error("Failed to parse AI response, trying fallback...", content.substring(0, 500));
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); }
      catch (fallbackError) { throw new Error(`Invalid JSON structure, even after fallback.`); }
    } else {
      throw new Error(`Invalid JSON structure. No JSON object found.`);
    }
  }

  if (
    !parsed.notes || 
    !Array.isArray(parsed.notes) || 
    parsed.notes.length === 0 || 
    !parsed.notes[0].title ||
    typeof parsed.notes[0].content !== 'string'
  ) {
    throw new Error("AI failed to return a valid note structure.");
  }

  if (!isContentMeaningful(parsed.notes[0].content)) {
     throw new Error("AI failed to generate meaningful content for this note.");
  }
  
  return parsed.notes[0];
}

// ---------------------------------------------------------------------------
// 3. FLASHCARD GENERATION
// ---------------------------------------------------------------------------

function buildFlashcardPrompt(text: string, numCards: number): string {
  return `Based strictly on the following text content, generate exactly ${numCards} flashcards. Focus on **key terms and their definitions**, **important concepts**, and **core principles** mentioned in the text.

For each flashcard:
- 'front_content' should be a term, concept, or question.
- 'back_content' should be its definition, explanation, or answer, derived directly from the text.

Text Content:
"""
${text}
"""

Return ONLY valid JSON in this exact shape:
{
  "flashcards": [
    { "front_content": "...", "back_content": "..." }
  ]
}`;
}

export async function callAIToGenerateFlashcards(text: string, numCards: number): Promise<{ front_content: string; back_content: string; }[]> {
  if (!API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY environment variable');

  const model = genAI.getGenerativeModel({
    model: AI_MODEL_NAME,
    generationConfig: {
      temperature: 0.5,
      responseMimeType: "application/json",
    },
  });

  const textSnippet = text.substring(0, MAX_INPUT_LENGTH);
  const prompt = buildFlashcardPrompt(textSnippet, numCards);
  
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const content = response.text();

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (parseError) {
    console.error("Failed to parse AI response, trying fallback...", content.substring(0, 500));
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); }
      catch (fallbackError) { throw new Error(`Invalid JSON structure, even after fallback.`); }
    } else {
      throw new Error(`Invalid JSON structure. No JSON object found.`);
    }
  }

  if (!parsed.flashcards || !Array.isArray(parsed.flashcards) || parsed.flashcards.length === 0) {
    throw new Error("AI failed to return valid flashcards.");
  }
  return parsed.flashcards;
}

// ---------------------------------------------------------------------------
// 4. AUDIO PROCESSING (VOICE NOTES - DIRECT UPLOAD)
// ---------------------------------------------------------------------------

export async function callAIToProcessAudio(audioFile: File): Promise<{ title: string; transcript: string; summary: string; suggestions: string[] }> {
  if (!GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY environment variable");

  // 1. Transcribe (Whisper)
  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,
    model: "distil-whisper-large-v3-en",
    response_format: "json",
    language: "en",
    temperature: 0.0,
  });

  const transcriptText = transcription.text;
  if (!transcriptText) throw new Error("Transcription failed or returned empty text.");

  // 2. Analyze (Llama 3)
  const systemPrompt = `You are an expert study assistant. Analyze the following transcript.
  
  Return a valid JSON object with:
  - "title": A concise, descriptive title.
  - "summary": A brief summary of key points (max 3 sentences).
  - "suggestions": An array of 3-5 specific study action items or follow-up questions.`;

  const completion = await groq.chat.completions.create({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcriptText }
    ],
    model: "llama3-70b-8192",
    temperature: 0.5,
    response_format: { type: "json_object" },
  });

  const analysisContent = completion.choices[0]?.message?.content;
  if (!analysisContent) throw new Error("Analysis failed or returned empty content.");

  let analysis: any;
  try {
    analysis = JSON.parse(analysisContent);
  } catch (e) {
    throw new Error("Failed to parse AI analysis JSON.");
  }

  return {
    title: analysis.title || "Untitled Recording",
    transcript: transcriptText,
    summary: analysis.summary || "No summary available.",
    suggestions: Array.isArray(analysis.suggestions) ? analysis.suggestions : []
  };
}

// ---------------------------------------------------------------------------
// 5. SERVER-SIDE AUDIO TRANSCRIPTION (URL/FILEPATH FALLBACK)
// ---------------------------------------------------------------------------

export async function transcribeAudioFile(filePath: string): Promise<string> {
  if (!GROQ_API_KEY) throw new Error("Missing GROQ_API_KEY environment variable");

  try {
    const fileStream = fs.createReadStream(filePath);

    const transcription = await groq.audio.transcriptions.create({
      file: fileStream,
      model: "distil-whisper-large-v3-en",
      response_format: "json",
      language: "en",
      temperature: 0.0,
    });

    return transcription.text;
  } catch (error: any) {
    console.error("Groq Transcription Error:", error);
    throw new Error(`Failed to transcribe audio: ${error.message}`);
  }
}