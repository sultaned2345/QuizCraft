// src/app/api/grade-essay/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { ApiResponse, GradeEssayData, GradeEssayResponseData, GradedEssayFeedback, EssayFeedbackCategory } from '@/types/database';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Prisma } from '@prisma/client';
import pdfParse from 'pdf-parse-fork';
import { cleanExtractedText } from '@/lib/file-parser';

export const runtime = 'nodejs';

// --- AI Configuration ---
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-2.5-flash-lite";

const WORD_LIMIT = 3000;
const countWords = (text: string): number => {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
};

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

// --- MODIFIED: Added 'strengths' to interface ---
interface AIFeedbackHighlight {
  text: string;
  comment: string;
}
interface AIFeedbackCategory {
  summary: string;
  highlights: AIFeedbackHighlight[];
}
interface AIGradedEssayResponse {
  score: number | null;
  feedback: {
    strengths: AIFeedbackCategory; // <-- ADDED
    clarity: AIFeedbackCategory;
    argument: AIFeedbackCategory;
    grammar: AIFeedbackCategory;
    summary: string; 
  };
  suggestions: string[];
}
// --- END MODIFICATION ---

// --- MODIFIED: Updated buildAIPrompt ---
function buildAIPrompt(essayText: string, rubricText?: string): string {
    const baseInstruction = `You are an encouraging and constructive writing professor. Your goal is to help the student improve, not just to criticize.
Provide detailed feedback on the essay. You MUST provide:
1.  An overall 'score' (0-100). Be fair. A score of 95-100 is reserved for truly exceptional writing that meets all rubric criteria flawlessly and demonstrates a unique voice or insight. A solid, well-written college paper might earn an 88-94.
2.  A 'feedback' object containing:
    a. 'strengths': An object with a 'summary' of what the essay does well and 'highlights' (array of {text, comment}) of 1-2 *positive* examples.
    b. 'clarity': An object with a 'summary' on clarity/flow and 'highlights' (array of {text, comment}) of 1-2 examples to improve.
    c. 'argument': An object with a 'summary' on the argument/evidence and 'highlights' (array of {text, comment}) of 1-2 examples to improve.
    d. 'grammar': An object with a 'summary' on grammar/style and 'highlights' (array of {text, comment}) of 1-2 examples to improve.
    e. 'summary': A holistic 'summary' of the essay.
3.  A list of 2-3 actionable 'suggestions' (strings) for improvement.

For 'highlights', find exact snippets ('text') from the essay. If no highlights are found for a category, return an empty array [].`;

     const rubricInstruction = rubricText 
       ? `Use the following specific rubric or instructions provided by the user:\n"""\n${rubricText}\n"""\n` 
       : `Evaluate based on standard academic criteria: Strengths (What is done well?), Clarity (Is the point clear?), Argument & Evidence (Is the logic sound?), Grammar & Style (Are there errors?), and provide an overall Summary.`;

     const outputFormat = `Return ONLY valid JSON in this exact shape:
{
  "score": 92,
  "feedback": {
    "strengths": {
      "summary": "You have a very clear thesis and your topic sentences are excellent.",
      "highlights": [
        {"text": "an exact snippet you did well", "comment": "This is a great example of using evidence."}
      ]
    },
    "clarity": {
      "summary": "Your clarity is...",
      "highlights": [
        {"text": "an exact text snippet from the essay", "comment": "This part was unclear because..."},
      ]
    },
    "argument": {
      "summary": "Your argument is...",
      "highlights": [
        {"text": "The main point is", "comment": "This is a strong thesis statement."}
      ]
    },
    "grammar": {
      "summary": "Your grammar is...",
      "highlights": [
        {"text": "students, who are smart,", "comment": "Incorrect comma usage here."}
      ]
    },
    "summary": "Overall, this essay..."
  },
  "suggestions": [
    "Try to vary sentence structure.",
    "Strengthen your thesis."
  ]
}`;

     return `${baseInstruction}\n\n${rubricInstruction}\n\nEssay Text:\n"""\n${essayText}\n"""\n\n${outputFormat}`;
}
// --- END MODIFICATION ---

async function callAIToGradeEssay(essayText: string, rubricText?: string): Promise<AIGradedEssayResponse> {
    if (!API_KEY) throw new Error("Missing GOOGLE_AI_API_KEY"); const genAI = new GoogleGenerativeAI(API_KEY); const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME, generationConfig, safetySettings }); const prompt = buildAIPrompt(essayText, rubricText); try { console.log(`Sending prompt to AI model: ${AI_MODEL_NAME} for grading...`); const result = await model.generateContent(prompt); const response = await result.response; const content = response.text(); if (!content) throw new Error("Empty response from AI model."); let parsed: AIGradedEssayResponse; try { parsed = JSON.parse(content); } catch (jsonError) { console.error("Failed to parse AI JSON response:", content); throw new Error("AI returned invalid JSON format."); } 
    
    if (!parsed || typeof parsed !== 'object') throw new Error("AI response is not a valid object."); 
    if (!parsed.feedback || typeof parsed.feedback !== 'object') throw new Error("AI response missing or invalid 'feedback' object."); 
    
    // --- MODIFIED: Check for 'strengths' category ---
    const categories: ('strengths' | 'clarity' | 'argument' | 'grammar')[] = ['strengths', 'clarity', 'argument', 'grammar'];
    for (const cat of categories) {
        if (!parsed.feedback[cat] || typeof parsed.feedback[cat].summary !== 'string' || !Array.isArray(parsed.feedback[cat].highlights)) {
             console.error(`AI response missing or invalid 'feedback.${cat}' structure.`);
             // Provide a default empty state
             parsed.feedback[cat] = { summary: `No feedback provided for ${cat}.`, highlights: [] };
        }
    }
    // --- END MODIFICATION ---

    if (!parsed.feedback.summary) parsed.feedback.summary = "No summary provided.";
    if (!Array.isArray(parsed.suggestions)) parsed.suggestions = []; 
    if (typeof parsed.score !== 'number' && parsed.score !== null) parsed.score = null; 
    
    console.log(`AI grading successful using ${AI_MODEL_NAME}.`); return parsed; } catch (error: any) { console.error(`Error calling or parsing AI response from ${AI_MODEL_NAME} for grading:`, error); throw new Error(`AI grading failed: ${error.message}`); }
}

// (POST Handler remains unchanged, as all logic is in the helpers)
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);

        // 1. Check AI Usage Limits
        const usageCheck = await checkAIGenerationUsageLimit(user.id);
        if (!usageCheck.isValid || !usageCheck.canGenerate) {
            return NextResponse.json<ApiResponse>({ 
                success: false, 
                error: usageCheck.error,
                message: usageCheck.message 
            }, { status: 403 });
        }

        // 2. Handle Input
        let essayText: string = "";
        let rubricText: string | undefined = undefined;
        let essayTitle: string | undefined = undefined;
        const MAX_FILE_SIZE = 3 * 1024 * 1024;
        const contentType = request.headers.get("content-type") || "";
        
        if (contentType.includes("multipart/form-data")) { 
            const formData = await request.formData(); 
            const file = formData.get('file') as File | null; 
            rubricText = formData.get('rubricText')?.toString() ?? undefined; 
            essayTitle = formData.get('essayTitle')?.toString() ?? undefined; 
            if (!file) throw new Error("No file provided."); 
            const fileBuffer = Buffer.from(await file.arrayBuffer()); 
            try { 
                if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith(".pdf")) { 
                    essayText = (await pdfParse(fileBuffer)).text || ''; 
                } else { 
                    essayText = fileBuffer.toString('utf8'); 
                } 
                essayText = cleanExtractedText(essayText); 
                if (!essayTitle) essayTitle = file.name; 
            } catch (e:any) { 
                throw new Error(`Failed extract text: ${e.message}`); 
            } 
        } else if (contentType.includes("application/json")) { 
            const body: GradeEssayData = await request.json(); 
            essayText = body.essayText; 
            rubricText = body.rubricText; 
            essayTitle = body.essayTitle; 
        } else { 
            throw new Error("Unsupported Content-Type."); 
        }
        
        if (!essayText || essayText.trim().length < 50) { 
            throw new Error("Essay text is too short (minimum 50 characters required)."); 
        }

        const wordCount = countWords(essayText);
        if (wordCount > WORD_LIMIT) {
            throw new Error(`Essay exceeds the ${WORD_LIMIT} word limit. You submitted ${wordCount} words.`);
        }

        // 3. Call AI to Grade Essay
        const aiResult = await callAIToGradeEssay(essayText, rubricText);

        if (!aiResult || !aiResult.feedback) {
            console.error("AI call succeeded log but aiResult or aiResult.feedback is missing/invalid.", aiResult);
            throw new Error("Failed to process AI feedback structure.");
        }

        // 4. Save to Database
        console.log("Attempting to save graded essay to DB...");
        const savedGradedEssay = await prisma.graded_essays.create({
             data: {
                 user_id: user.id,
                 essay_title: essayTitle?.trim() || `Graded Essay - ${new Date().toLocaleDateString()}`,
                 essay_content: essayText,
                 rubric_or_criteria: rubricText,
                 // FIX: Double-cast to unknown first to satisfy Prisma type check
                 feedback: aiResult.feedback as unknown as Prisma.JsonObject,
                 score: aiResult.score,
             },
             select: { id: true, graded_at: true }
         });
         console.log("Saved graded essay to DB:", savedGradedEssay.id);


        // 5. Increment AI Usage Count
        console.log("Attempting to update AI usage...");
        await incrementAIGenerationUsage(user.id, 1);
        console.log("Finished updating AI usage.");


        // 6. Prepare and Return Response Data
        const responseData: GradeEssayResponseData = {
            id: savedGradedEssay.id,
            feedback: aiResult.feedback,
            score: aiResult.score,
            suggestions: aiResult.suggestions,
            graded_at: savedGradedEssay.graded_at?.toISOString() || '',
            essay_content: essayText,
        };
        return NextResponse.json<ApiResponse<GradeEssayResponseData>>({
            success: true,
            data: responseData,
            message: 'Essay graded successfully.'
        });

    } catch (error: any) {
        if (error instanceof Response) return error;

        console.error('Error caught in /api/grade-essay POST handler:', error);

        if (error.message?.includes("AI usage")) {
             console.error("Critical error: Failed to update AI usage count:", error.message);
             return NextResponse.json<ApiResponse>({ success: false, error: "Failed to update usage count after grading." }, { status: 500 });
        }
         if (error.message?.includes("AI grading failed:") || error.message?.includes("AI Error:")) {
             return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 502 });
         }
         if (error.message?.includes("Failed to process AI feedback structure.")) {
             return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 });
         }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             console.error('Prisma Error saving graded essay:', { code: error.code, meta: error.meta });
             return NextResponse.json<ApiResponse>({ success: false, error: 'Database error occurred while saving feedback.' }, { status: 500 });
        }

        const errorMessage = error.message || 'Failed to grade essay';
        const status = (error.message.includes("limit") || error.message.includes("characters required") || error.message.includes("Invalid file type") || error.message.includes("Unsupported Content-Type") || error.message.includes("word limit exceeded")) ? 400 : 500;
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status });
    }
}