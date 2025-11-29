// src/lib/aiGeneration.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Question, QuestionType } from '@/types/database';
import { Prisma } from '@prisma/client';

const API_KEY = process.env.GOOGLE_AI_API_KEY || "";

// --- ENFORCED: Use gemini-2.5-flash-lite ---
const AI_MODEL_NAME = "gemini-2.5-flash-lite"; 

// --- UPDATED: 500k limit (Safe "Full Text" Mode) ---
const MAX_INPUT_LENGTH = 500000; 

if (!API_KEY) {
    console.warn("Missing GOOGLE_AI_API_KEY environment variable. AI generation will fail.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

function isContentMeaningful(content: string): boolean {
    if (!content) return false;
    const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.length > 20; 
}

// ---------------------------------------------------------------------------
// 1. QUIZ GENERATION (Smarter Prompts)
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

  // --- IMPROVED SYSTEM PROMPT ---
  const system = `You are a strict university professor creating a ${difficulty} difficulty exam.
  
  Your Goal: Test **deep understanding**, **critical thinking**, and **application** of concepts.
  
  Guidelines:
  1. **No "Giveaway" Answers:** Wrong options (distractors) must be plausible and related to the topic. Avoid silly or obviously incorrect answers.
  2. **Avoid Laziness:** Do not use "All of the above" or "None of the above".
  3. **Focus on "Why" and "How":** Prioritize questions about cause-and-effect, mechanisms, and relationships between ideas over simple definition recall.
  4. **Strict JSON:** Return ONLY valid JSON.`;

  const user = `Based strictly on the content below, generate exactly ${numQuestions} questions of type(s): ${questionTypes}.

Content:
"""
${text}
"""

Return ONLY valid JSON with this exact shape:
{
  "title": "string", // A professional, academic title for the quiz
  "questions": [
    {
      "question_text": "string", // The question stem
      "question_type": "MULTIPLE_CHOICE",
      "options": ["string", "string", "string", "string"], // 1 Correct + 3 Plausible Distractors
      "correct_answer": "string", // Must match one option exactly
      "explanation": "string" // Explain WHY the answer is correct and why others are wrong
    },
    {
      "question_text": "string",
      "question_type": "TRUE_FALSE",
      "correct_answer": "True" | "False",
      "explanation": "string"
    },
    {
      "question_text": "string", // Use "____" for blanks
      "question_type": "FILL_IN_THE_BLANK",
      "options": ["string"], // Accepted answers
      "correct_answer": "N/A",
      "explanation": "string"
    },
    {
      "question_text": "Match the following related items:",
      "question_type": "MATCHING",
      "prompts": ["Concept A", "Concept B", "Concept C"],
      "options": ["Definition A", "Definition B", "Definition C"],
      "correct_answer": "N/A",
      "explanation": "Briefly explain the connections."
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
      temperature: 0.3, // Lower temperature for more focused/factual questions
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
    throw new Error('Gemini returned invalid or empty data structure.');
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

// ... (Note and Flashcard functions remain unchanged, or you can apply similar logic) ...
// ---------------------------------------------------------------------------
// 2. NOTE GENERATION
// ---------------------------------------------------------------------------

function buildNotePrompt({ text }: { text: string }): string {
  return `You are an expert note-taker. Based on the following content, generate structured summary notes.

You MUST format the notes as clean, semantic HTML.
- Use <h2> for main topics.
- Use <h3> for sub-topics.
- Use <ul> and <li> for bullet points.
- Use <strong> for key terms.
- Use <p> for paragraphs.
- Do NOT use any Markdown (like ##, **, or -).
- Do NOT use <html>, <body>, or <head> tags.

Content:
"""
${text}
"""

Return ONLY valid JSON in this exact shape. The "content" field MUST be a valid HTML string (at least 50 characters) and MUST NOT be empty.

{
  "notes": [
    {
      "title": "Concise Title Reflecting Main Topic",
      "content": "<h2>Main Topic 1</h2><p>This is a summary paragraph.</p>..."
    }
  ]
}`;
}

export async function callAIToGenerateNote(text: string): Promise<{ title: string; content: string; }> {
  if (!API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY environment variable');

  const model = genAI.getGenerativeModel({
    model: AI_MODEL_NAME,
    generationConfig: {
      temperature: 0.5,
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

  if (!parsed.notes || !Array.isArray(parsed.notes) || parsed.notes.length === 0 || !parsed.notes[0].title || typeof parsed.notes[0].content !== 'string') {
    throw new Error("AI failed to return a valid note structure with title and content.");
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