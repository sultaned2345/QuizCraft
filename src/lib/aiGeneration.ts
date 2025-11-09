// src/lib/aiGeneration.ts
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Question, QuestionType } from '@/types/database';
import { Prisma } from '@prisma/client';

const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-2.5-flash-lite";

if (!API_KEY) {
    console.warn("Missing GOOGLE_AI_API_KEY environment variable. AI generation will fail.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// --- Helper for Quiz Generation ---

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
  "title": string, // a concise quiz title based on the content
  "questions": [
    {
      "question_text": string,
      "question_type": "MULTIPLE_CHOICE",
      "options": [string, string, string, string],
      "correct_answer": string,
      "explanation": string
    },
    {
      "question_text": string,
      "question_type": "TRUE_FALSE",
      "correct_answer": "True" | "False",
      "explanation": string
    },
    {
      "question_text": string, // use "____" for the blank(s)
      "question_type": "FILL_IN_THE_BLANK",
      "options": [string], // An array of one or more acceptable answers
      "correct_answer": "N/A", // Not used, options array is used
      "explanation": string
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

  const prompt = buildQuizPrompt({ text, numQuestions, difficulty, questionType });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const content = response.text();

  if (!content) throw new Error('Empty response from Gemini');

  // (Add light cleanup/fallback parsing if needed)
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

  // Sanitize and format questions
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


// --- Helper for Note Generation ---

function buildNotePrompt({ text }: { text: string }): string {
  return `Based on the following content, generate structured notes summarizing the **key concepts, definitions, examples, and important points**. Organize the notes logically, potentially using headings or bullet points using markdown syntax (e.g., '# Heading', '- Bullet point') for clarity. The notes should be detailed enough to capture the essential information from the text. The output must include a main "title" for the notes and the detailed "content".

Content:
"""
${text}
"""

Return ONLY valid JSON in this exact shape:
{
  "notes": [
    {
      "title": "Concise Title Reflecting Main Topic",
      "content": "Detailed structured notes covering key points, definitions, examples etc. Use markdown for formatting like headings (# Heading 1, ## Heading 2) or bullet points (- Point)."
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

  const prompt = buildNotePrompt({ text });
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

  // --- THIS IS THE FIX ---
  // Safely check for the existence and content of the first note.
  if (
    !parsed.notes || 
    !Array.isArray(parsed.notes) || 
    parsed.notes.length === 0 || 
    !parsed.notes[0].title || 
    !parsed.notes[0].content || // 1. Check that 'content' key exists
    typeof parsed.notes[0].content !== 'string' || // 2. Check that it's a string
    parsed.notes[0].content.trim().length === 0 // 3. NOW it's safe to check length
  ) {
    throw new Error("AI failed to return a valid note structure with title and content.");
  }
  // --- END FIX ---
  
  return parsed.notes[0];
}


// --- Helper for Flashcard Generation ---

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

  const prompt = buildFlashcardPrompt(text, numCards);
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