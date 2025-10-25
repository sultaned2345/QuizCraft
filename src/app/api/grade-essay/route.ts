// src/app/api/grade-essay/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit } from '@/lib/usage-limits';
import { supabaseHelpers } from '@/lib/supabase'; // For incrementing usage
import { ApiResponse, GradeEssayData, GradeEssayResponseData, GradedEssayFeedback } from '@/types/database';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Prisma } from '@prisma/client';
import pdfParse from 'pdf-parse-fork'; // For file upload
import { cleanExtractedText } from '@/lib/file-parser'; // For file upload

export const runtime = 'nodejs';

// --- AI Configuration ---
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-1.5-flash"; // Or gemini-1.5-pro

const generationConfig = {
  temperature: 0.6,
  topK: 1,
  topP: 1,
  maxOutputTokens: 4096,
  responseMimeType: "application/json",
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

// --- Expected AI JSON Output Structure ---
interface AIGradedEssayResponse {
  score: number | null; // e.g., 75 (out of 100), or null if not applicable/calculable
  feedback: GradedEssayFeedback; // Matches the type defined in database.ts
  suggestions: string[]; // Array of actionable suggestions
}


// --- Helper Function to Build AI Prompt ---
function buildAIPrompt(essayText: string, rubricText?: string): string {
    const baseInstruction = `You are a helpful writing tutor providing feedback on an essay. Analyze the essay based on the criteria provided (if any). Evaluate clarity, structure, argument strength, evidence usage (if applicable), grammar, and style. Provide constructive feedback for each category and an overall summary. Also, suggest 2-3 specific, actionable improvements. Finally, provide an estimated overall score out of 100 (if possible, otherwise null).`;

    const rubricInstruction = rubricText
        ? `Use the following rubric/criteria for your evaluation:\n"""\n${rubricText}\n"""\n`
        : `Evaluate based on standard academic essay criteria (clarity, argumentation, evidence, grammar, style).`;

    const outputFormat = `Return ONLY valid JSON in this exact shape:
{
  "score": number | null, // Estimated score out of 100, or null
  "feedback": {
    "clarity": "string", // Feedback on clarity and organization
    "argument": "string", // Feedback on argument strength and evidence (or general content if not argumentative)
    "grammar": "string", // Feedback on grammar, style, and mechanics
    "summary": "string" // Overall summary of strengths and weaknesses
  },
  "suggestions": [ // Array of 2-3 specific, actionable suggestions
    "string"
  ]
}`;

    return `${baseInstruction}\n\n${rubricInstruction}\n\nEssay Text:\n"""\n${essayText}\n"""\n\n${outputFormat}`;
}

// --- Helper Function to Call AI ---
async function callAIToGradeEssay(essayText: string, rubricText?: string): Promise<AIGradedEssayResponse> {
    if (!API_KEY) throw new Error("Missing GOOGLE_AI_API_KEY");

    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME, generationConfig, safetySettings });
    const prompt = buildAIPrompt(essayText, rubricText);

    try {
        console.log("Sending prompt to AI for grading...");
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const content = response.text();

        if (!content) throw new Error("Empty response from AI model.");

        const parsed: AIGradedEssayResponse = JSON.parse(content);

        // --- Basic Validation of AI Response ---
        if (!parsed.feedback || typeof parsed.feedback !== 'object') throw new Error("AI response missing 'feedback' object.");
        if (!parsed.feedback.summary) parsed.feedback.summary = "No summary provided."; // Ensure summary exists
        if (!Array.isArray(parsed.suggestions)) parsed.suggestions = []; // Ensure suggestions is an array
        if (typeof parsed.score !== 'number' && parsed.score !== null) parsed.score = null; // Ensure score is number or null

        console.log("AI grading successful.");
        return parsed;

    } catch (error: any) {
        console.error("Error calling or parsing AI response for grading:", error);
        throw new Error(`AI grading failed: ${error.message}`);
    }
}

// --- POST Handler ---
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);

        // 1. Check AI Usage Limits (Count as 1 generation)
        const usageCheck = await checkAIGenerationUsageLimit(user.id);
        if (!usageCheck.isValid || !usageCheck.canGenerate) {
            return NextResponse.json<ApiResponse>({ success: false, error: usageCheck.error, message: usageCheck.message }, { status: 403 });
        }

        let essayText: string = "";
        let rubricText: string | undefined = undefined;
        let essayTitle: string | undefined = undefined;
        let inputSource: string = "text"; // For logging/tracking
        const MAX_FILE_SIZE = 3 * 1024 * 1024; // Reuse constant

        // 2. Handle Input (JSON or File Upload)
        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("multipart/form-data")) {
            inputSource = "file";
            const formData = await request.formData();
            const file = formData.get('file') as File | null;
            rubricText = formData.get('rubricText')?.toString() ?? undefined;
            essayTitle = formData.get('essayTitle')?.toString() ?? undefined;

            if (!file) throw new Error("No file provided in form data.");

            // Basic file validation
            if (!['application/pdf', 'text/plain'].includes(file.type) && !['.pdf', '.txt'].some(ext => file.name.toLowerCase().endsWith(ext))) {
                 throw new Error("Invalid file type. Only PDF and TXT allowed for essays.");
            }
             if (file.size > MAX_FILE_SIZE) {
                 throw new Error(`File exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit.`);
             }

            const fileBuffer = Buffer.from(await file.arrayBuffer());
            try {
                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith(".pdf")) {
                     essayText = (await pdfParse(fileBuffer)).text || '';
                } else {
                     essayText = fileBuffer.toString('utf8');
                }
                essayText = cleanExtractedText(essayText);
                 if (!essayTitle) essayTitle = file.name; // Use filename as title if none provided
            } catch (extractError: any) {
                throw new Error(`Failed to extract text from file: ${extractError.message}`);
            }

        } else if (contentType.includes("application/json")) {
             const body: GradeEssayData = await request.json();
             essayText = body.essayText;
             rubricText = body.rubricText;
             essayTitle = body.essayTitle;
        } else {
            throw new Error("Unsupported Content-Type. Use application/json or multipart/form-data.");
        }

        // Validate extracted/provided text
        if (!essayText || essayText.trim().length < 50) { // Require minimum length
            throw new Error("Essay text is too short (minimum 50 characters required).");
        }

        // 3. Call AI to Grade Essay
        const aiResult = await callAIToGradeEssay(essayText, rubricText);

        // 4. Save to Database
        const savedGradedEssay = await prisma.graded_essays.create({
            data: {
                user_id: user.id,
                essay_title: essayTitle?.trim() || `Graded Essay - ${new Date().toLocaleDateString()}`, // Default title
                essay_content: essayText, // Save the original essay
                rubric_or_criteria: rubricText,
                feedback: aiResult.feedback as Prisma.JsonObject, // Cast feedback to Prisma.JsonObject
                score: aiResult.score,
                // graded_at is set by default
            },
            select: { id: true, graded_at: true } // Select only needed fields for response
        });

        // 5. Increment AI Usage Count (Important!)
        await supabaseHelpers.incrementAIGenerationUsage(user.id, new Date(), 1); // Count as 1 usage

        // 6. Prepare and Return Response Data
        const responseData: GradeEssayResponseData = {
            id: savedGradedEssay.id,
            feedback: aiResult.feedback,
            score: aiResult.score,
            suggestions: aiResult.suggestions,
            graded_at: savedGradedEssay.graded_at?.toISOString() || '',
        };

        return NextResponse.json<ApiResponse<GradeEssayResponseData>>({
            success: true,
            data: responseData,
            message: 'Essay graded successfully.'
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors

        console.error('Error in /api/grade-essay:', error);
        // Specific error handling (e.g., from AI, Prisma)
        if (error.message.startsWith('AI grading failed:') || error.message.includes('GOOGLE_AI_API_KEY')) {
             return NextResponse.json<ApiResponse>({ success: false, error: `AI Error: ${error.message}` }, { status: 502 }); // Bad Gateway for AI issues
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             console.error('Prisma Error grading essay:', { code: error.code, meta: error.meta });
             return NextResponse.json<ApiResponse>({ success: false, error: 'Database error occurred while saving feedback.' }, { status: 500 });
        }

        // Generic error
        const errorMessage = error.message || 'Failed to grade essay';
        const status = (error.message.includes("limit") || error.message.includes("characters required") || error.message.includes("Invalid file type")) ? 400 : 500; // Adjust status for known input errors
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status });
    }
}