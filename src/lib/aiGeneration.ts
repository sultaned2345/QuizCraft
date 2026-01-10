// src/lib/aiGeneration.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { QuestionType } from '@/types/database';
import { Prisma } from '@prisma/client';
import Groq from "groq-sdk"; 

const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

// --- UPDATED: Use standard Flash model for stability ---
const AI_MODEL_NAME = "gemini-1.5-flash"; 
const MAX_INPUT_LENGTH = 30000; // Safe limit for standard Flash

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
    // Strip HTML tags and normalize whitespace
    const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    // Check if the remaining text has at least 20 characters
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

  // Safety truncate
  const textSnippet = text.substring(0, MAX_INPUT_LENGTH);
  const prompt = buildQuizPrompt({ text: textSnippet, numQuestions, difficulty, questionType });

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    if (!content) throw new Error('Empty response from Gemini');

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.warn("JSON parse failed, attempting regex repair...", content.substring(0, 100));
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse JSON from AI response');
      }
    }

    if (!parsed || !parsed.questions || !Array.isArray(parsed.questions)) {
      throw new Error('Invalid JSON structure: missing questions array');
    }

    const sanitizedQuestions = parsed.questions.map((q: any) => ({
      question_text: q.question_text || "Untitled Question",
      question_type: q.question_type || "MULTIPLE_CHOICE",
      correct_answer: q.correct_answer || "",
      options: Array.isArray(q.options) ? q.options : (q.question_type === 'TRUE_FALSE' ? ["True", "False"] : Prisma.JsonNull),
      prompts: Array.isArray(q.prompts) ? q.prompts : Prisma.JsonNull,
      explanation: q.explanation || "",
    }));

    return { title: parsed.title || "Generated Quiz", questions: sanitizedQuestions };

  } catch (error: any) {
    console.error("Quiz Generation Error:", error);
    // Return a safe fallback or rethrow depending on preference. Rethrowing lets the API handle the 500.
    throw new Error(`AI Quiz Generation Failed: ${error.message}`);
  }
}

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
- The HTML content must be detailed and capture the essential information.

Content:
"""
${text}
"""

Return ONLY valid JSON in this exact shape. The "content" field MUST be a valid HTML string (at least 50 characters) and MUST NOT be empty or just "<p></p>".

{
  "notes": [
    {
      "title": "Concise Title Reflecting Main Topic",
      "content": "<h2>Main Topic 1</h2><p>This is a summary paragraph.</p><h3>Sub-topic 1.1</h3><ul><li><strong>Key Term:</strong> Definition...</li><li>Another key point...</li></ul><h2>Main Topic 2</h2><p>More details...</p>"
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

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();
    
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
       const jsonMatch = content.match(/\{[\s\S]*\}/);
       if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
       else throw new Error("Invalid JSON from AI");
    }

    // Validations
    if (!parsed.notes || !Array.isArray(parsed.notes) || parsed.notes.length === 0) {
      throw new Error("AI returned invalid note structure.");
    }

    const note = parsed.notes[0];
    if (!note.title || !note.content) {
        throw new Error("Note missing title or content.");
    }

    return note;

  } catch (error: any) {
    console.error("Note Generation Error:", error);
    throw new Error(`AI Note Generation Failed: ${error.message}`);
  }
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
  
  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    let parsed: any;
    try {
        parsed = JSON.parse(content);
    } catch (e) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        else throw new Error("Invalid JSON");
    }

    if (!parsed.flashcards || !Array.isArray(parsed.flashcards)) {
        throw new Error("Invalid flashcards structure.");
    }
    
    return parsed.flashcards;

  } catch (error: any) {
    console.error("Flashcard Gen Error:", error);
    throw new Error(`AI Flashcard Gen Failed: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// 4. AUDIO PROCESSING (VOICE NOTES - GROQ)
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
// 5. INSIGHTS GENERATION
// ---------------------------------------------------------------------------

function buildInsightsPrompt(text: string): string {
  return `You are an expert analyst. Analyze the following document content and provide key insights.

Content:
"""
${text}
"""

Return ONLY valid JSON in this exact shape:
{
  "summary": "A concise summary of the document (max 3 sentences).",
  "key_insights": ["Insight 1", "Insight 2", "Insight 3", "Insight 4", "Insight 5"],
  "related_topics": ["Topic 1", "Topic 2", "Topic 3"]
}`;
}

export async function callAIToGenerateInsights(text: string): Promise<{ summary: string; key_insights: string[]; related_topics: string[] }> {
  if (!API_KEY) throw new Error('Missing GOOGLE_AI_API_KEY environment variable');

  const model = genAI.getGenerativeModel({
    model: AI_MODEL_NAME,
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
    },
  });

  const textSnippet = text.substring(0, MAX_INPUT_LENGTH);
  const prompt = buildInsightsPrompt(textSnippet);

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    let parsed: any;
    try {
        parsed = JSON.parse(content);
    } catch (e) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        else throw new Error("Invalid JSON");
    }

    return {
        summary: parsed.summary || "No summary available.",
        key_insights: Array.isArray(parsed.key_insights) ? parsed.key_insights : [],
        related_topics: Array.isArray(parsed.related_topics) ? parsed.related_topics : []
    };
  } catch (error: any) {
    console.error("Insights Gen Error:", error);
    throw new Error(`AI Insights Failed: ${error.message}`);
  }
}