// src/lib/aiGeneration.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { QuestionType } from '@/types/database'; // Adjust path if needed
import { Prisma } from '@prisma/client';

const API_KEY = process.env.GOOGLE_AI_API_KEY || "";

// --- CONFIGURATION ---
// User-specified model
const AI_MODEL_NAME = "gemini-2.5-flash-lite"; 

// Flash models support 1M+ tokens, so 100k chars is very safe
const MAX_INPUT_LENGTH = 100000; 

if (!API_KEY) {
    console.warn("Missing GOOGLE_AI_API_KEY environment variable. AI generation will fail.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * Strips HTML tags and checks if the remaining text is meaningful.
 * Crucial for validating AI responses.
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

  const system = `You are an expert quiz creator. Based ONLY on the provided text, generate exactly ${numQuestions} ${difficulty} difficulty ${questionTypes} questions. Focus on the most important concepts.`;

  const user = `Generate ${numQuestions} ${difficulty} difficulty quiz questions of the following type(s): ${questionTypes}, based *only* on the content below.

Content:
"""
${text}
"""

Return ONLY valid JSON with this exact shape:
{
  "title": "string", // a concise quiz title
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
      "question_text": "string", // use "____" for the blank
      "question_type": "FILL_IN_THE_BLANK",
      "options": ["string"], 
      "correct_answer": "N/A", 
      "explanation": "string"
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
  if (!API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY');

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
    console.error("Failed to parse AI response, trying regex fallback...");
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); }
      catch (e) { throw new Error(`Invalid JSON structure.`); }
    } else {
      throw new Error(`Invalid JSON structure.`);
    }
  }

  if (!parsed || !parsed.questions || !Array.isArray(parsed.questions)) {
     throw new Error("Invalid quiz format returned by AI");
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
// 2. NOTE GENERATION (Updated for Audio Transcripts)
// ---------------------------------------------------------------------------

function buildNotePrompt({ text }: { text: string }): string {
  // --- UPDATED PROMPT FOR LECTURE HANDLING ---
  return `You are an expert academic note-taker. The content below may be a **raw transcript of a spoken lecture**, which might contain conversational filler (um, uh, like), tangents, or messy grammar.

Your goal is to convert this text into clean, structured, and professional study notes.

Guidelines:
1. **Clean Up:** Ignore filler words, repetitions, and irrelevant tangents.
2. **Structure:** Organize by clear logical topics and sub-topics.
3. **Format (HTML):**
   - Use <h2> for main topics.
   - Use <h3> for sub-topics.
   - Use <ul> and <li> for bullet points (crucial for readability).
   - Use <strong> for key terms and definitions.
   - Use <p> for detailed explanations.
   - Do NOT use Markdown symbols (like ## or **). Return pure HTML string.
   - Do NOT use <html>, <body>, or <head> tags.

Content to summarize:
"""
${text}
"""

Return ONLY valid JSON in this exact shape:
{
  "notes": [
    {
      "title": "Concise Lecture Title",
      "content": "<h2>Main Topic</h2><p>Explanation...</p><ul><li>Point 1</li></ul>..."
    }
  ]
}`;
}

export async function callAIToGenerateNote(text: string): Promise<{ title: string; content: string; }> {
  if (!API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY environment variable');

  const model = genAI.getGenerativeModel({
    model: AI_MODEL_NAME,
    generationConfig: {
      temperature: 0.5, // Slightly higher for smoother writing
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
    console.warn("Failed to parse AI response, trying fallback...", content.substring(0, 100));
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); }
      catch (e) { throw new Error(`Invalid JSON structure.`); }
    } else {
      throw new Error(`Invalid JSON structure.`);
    }
  }

  // --- ROBUST VALIDATION ---
  if (
    !parsed.notes || 
    !Array.isArray(parsed.notes) || 
    parsed.notes.length === 0 || 
    !parsed.notes[0].title ||
    typeof parsed.notes[0].content !== 'string'
  ) {
    console.error("Invalid note structure:", parsed);
    throw new Error("AI failed to return valid note structure with title/content.");
  }

  if (!isContentMeaningful(parsed.notes[0].content)) {
     console.error("Meaningless content generated:", parsed.notes[0]);
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
    { "front_content": "Term/Question", "back_content": "Definition/Answer" }
  ]
}`;
}

export async function callAIToGenerateFlashcards(text: string, numCards: number): Promise<{ front_content: string; back_content: string; }[]> {
  if (!API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY');

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
    console.warn("Failed to parse AI response, trying fallback...");
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); }
      catch (e) { throw new Error(`Invalid JSON structure.`); }
    } else {
      throw new Error(`Invalid JSON structure.`);
    }
  }

  if (!parsed.flashcards || !Array.isArray(parsed.flashcards) || parsed.flashcards.length === 0) {
    throw new Error("AI failed to return valid flashcards.");
  }
  return parsed.flashcards;
}