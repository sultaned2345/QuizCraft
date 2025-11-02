// src/app/api/grade-essay/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit } from '@/lib/usage-limits';
import { supabaseAdmin } from '@/lib/supabaseAdmin'; // Use admin client for usage update
import { ApiResponse, GradeEssayData, GradeEssayResponseData, GradedEssayFeedback, EssayFeedbackCategory } from '@/types/database';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Prisma } from '@prisma/client';
import pdfParse from 'pdf-parse-fork';
import { cleanExtractedText } from '@/lib/file-parser';

export const runtime = 'nodejs';

// --- AI Configuration ---
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-2.5-flash-lite";

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

// --- MODIFICATION: Updated AI JSON Output Structure ---
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
    clarity: AIFeedbackCategory;
    argument: AIFeedbackCategory;
    grammar: AIFeedbackCategory;
    summary: string; // Keep overall summary simple
    // We can add more categories here
  };
  suggestions: string[];
}

// --- MODIFICATION: Helper Function to Build NEW AI Prompt ---
function buildAIPrompt(essayText: string, rubricText?: string): string {
    const baseInstruction = `You are a helpful writing tutor. Your task is to provide detailed feedback on an essay.
Analyze the essay based on the user's rubric or standard academic criteria (clarity, argument, grammar).
You MUST provide:
1.  An overall 'score' (0-100) or null if not applicable.
2.  A list of 'suggestions' (1-3 strings) for improvement.
3.  A 'feedback' object with:
    a. 'clarity': An object with 'summary' (string) and 'highlights' (array of {text, comment}).
    b. 'argument': An object with 'summary' (string) and 'highlights' (array of {text, comment}).
    c. 'grammar': An object with 'summary' (string) and 'highlights' (array of {text, comment}).
    d. 'summary': An overall summary (string) of the essay.

For 'highlights', find 1-2 exact snippets ('text') from the essay for each category (clarity, argument, grammar) and provide a 'comment' for each snippet. If no highlights are found for a category, return an empty array [].`;

     const rubricInstruction = rubricText 
       ? `Use the following specific rubric or instructions provided by the user:\n"""\n${rubricText}\n"""\n` 
       : `Evaluate based on standard academic criteria: Clarity (Is the point clear?), Argument (Is the logic sound?), Grammar (Are there errors?), and provide an overall Summary.`;

     // --- MODIFICATION: Updated output format ---
     const outputFormat = `Return ONLY valid JSON in this exact shape:
{
  "score": number | null,
  "feedback": {
    "clarity": {
      "summary": "Your clarity is...",
      "highlights": [
        {"text": "an exact text snippet from the essay", "comment": "This part was unclear because..."},
        {"text": "another snippet", "comment": "This sentence is very clear."}
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
     // --- END MODIFICATION ---

     return `${baseInstruction}\n\n${rubricInstruction}\n\nEssay Text:\n"""\n${essayText}\n"""\n\n${outputFormat}`;
}

// --- Helper Function to Call AI ---
async function callAIToGradeEssay(essayText: string, rubricText?: string): Promise<AIGradedEssayResponse> {
    if (!API_KEY) throw new Error("Missing GOOGLE_AI_API_KEY"); const genAI = new GoogleGenerativeAI(API_KEY); const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME, generationConfig, safetySettings }); const prompt = buildAIPrompt(essayText, rubricText); try { console.log(`Sending prompt to AI model: ${AI_MODEL_NAME} for grading...`); const result = await model.generateContent(prompt); const response = await result.response; const content = response.text(); if (!content) throw new Error("Empty response from AI model."); let parsed: AIGradedEssayResponse; try { parsed = JSON.parse(content); } catch (jsonError) { console.error("Failed to parse AI JSON response:", content); throw new Error("AI returned invalid JSON format."); } 
    
    /* --- MODIFICATION: Stricter Validation --- */ 
    if (!parsed || typeof parsed !== 'object') throw new Error("AI response is not a valid object."); 
    if (!parsed.feedback || typeof parsed.feedback !== 'object') throw new Error("AI response missing or invalid 'feedback' object."); 
    
    // Validate each category
    const categories: ('clarity' | 'argument' | 'grammar')[] = ['clarity', 'argument', 'grammar'];
    for (const cat of categories) {
        if (!parsed.feedback[cat] || typeof parsed.feedback[cat].summary !== 'string' || !Array.isArray(parsed.feedback[cat].highlights)) {
             console.error(`AI response missing or invalid 'feedback.${cat}' structure.`);
             // Create a fallback structure so the request doesn't fail
             parsed.feedback[cat] = { summary: `No feedback provided for ${cat}.`, highlights: [] };
        }
    }
    if (!parsed.feedback.summary) parsed.feedback.summary = "No summary provided.";
    if (!Array.isArray(parsed.suggestions)) parsed.suggestions = []; 
    if (typeof parsed.score !== 'number' && parsed.score !== null) parsed.score = null; 
    /* --- END MODIFICATION --- */
    
    console.log(`AI grading successful using ${AI_MODEL_NAME}.`); return parsed; } catch (error: any) { console.error(`Error calling or parsing AI response from ${AI_MODEL_NAME} for grading:`, error); throw new Error(`AI grading failed: ${error.message}`); }
}

// --- Helper to Update AI Usage using SERVICE ROLE ---
async function updateAIUsage(userId: string, month: Date, count: number = 1) {
    // ... (keep existing updateAIUsage logic using supabaseAdmin) ...
    if(count<=0) return; const firstDayOfMonth=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),1)).toISOString().split('T')[0]; const supabase=supabaseAdmin; try { console.log(`[Admin] Fetch AI usage for ${userId} month ${firstDayOfMonth}`); const {data:currentUsage,error:fetchError}=await supabase.from('ai_usage').select('usage_count').eq('user_id',userId).eq('usage_month',firstDayOfMonth).maybeSingle(); if(fetchError&&fetchError.code!=='PGRST116'){console.error("[Admin] Supabase fetch error (updateAIUsage):",fetchError); throw new Error(`Failed fetch AI usage: ${fetchError.message} (Code: ${fetchError.code})`);} const currentCount=currentUsage?.usage_count??0; const newCount=currentCount+count; console.log(`[Admin] Upsert AI usage for ${userId} month ${firstDayOfMonth} to ${newCount}`); const {error:upsertError}=await supabase.from('ai_usage').upsert({user_id:userId,usage_month:firstDayOfMonth,usage_count:newCount,updated_at:new Date().toISOString(),},{onConflict:'user_id, usage_month'}); if(upsertError){console.error("[Admin] Supabase upsert error (updateAIUsage):",upsertError); throw new Error(`Failed upsert AI usage: ${upsertError.message} (Code: ${upsertError.code})`);} console.log(`[Admin] Successfully updated AI usage for ${userId} in ${firstDayOfMonth}.`);} catch(error){console.error(`[Admin] Error during AI usage update for ${userId}:`,error); throw error;}
}


// --- POST Handler ---
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request);

        // 1. Check AI Usage Limits
        const usageCheck = await checkAIGenerationUsageLimit(user.id);
        if (!usageCheck.isValid || !usageCheck.canGenerate) {
            return NextResponse.json<ApiResponse>({ success: false, error: usageCheck.error, message: usageCheck.message }, { status: 403 });
        }

        // 2. Handle Input
        let essayText: string = "";
        let rubricText: string | undefined = undefined;
        let essayTitle: string | undefined = undefined;
        const MAX_FILE_SIZE = 3 * 1024 * 1024;
        const contentType = request.headers.get("content-type") || "";
        // ... (keep logic for handling multipart/form-data and application/json) ...
        if (contentType.includes("multipart/form-data")) { const formData = await request.formData(); const file = formData.get('file') as File | null; rubricText = formData.get('rubricText')?.toString() ?? undefined; essayTitle = formData.get('essayTitle')?.toString() ?? undefined; if (!file) throw new Error("No file provided."); /* file validation */ const fileBuffer = Buffer.from(await file.arrayBuffer()); try { if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith(".pdf")) { essayText = (await pdfParse(fileBuffer)).text || ''; } else { essayText = fileBuffer.toString('utf8'); } essayText = cleanExtractedText(essayText); if (!essayTitle) essayTitle = file.name; } catch (e:any) { throw new Error(`Failed extract text: ${e.message}`); } } else if (contentType.includes("application/json")) { const body: GradeEssayData = await request.json(); essayText = body.essayText; rubricText = body.rubricText; essayTitle = body.essayTitle; } else { throw new Error("Unsupported Content-Type."); }
        if (!essayText || essayText.trim().length < 50) { throw new Error("Essay text is too short (minimum 50 characters required)."); }


        // 3. Call AI to Grade Essay
        const aiResult = await callAIToGradeEssay(essayText, rubricText);

        // --- ADDED CHECK ---
        if (!aiResult || !aiResult.feedback) {
            console.error("AI call succeeded log but aiResult or aiResult.feedback is missing/invalid.", aiResult);
            throw new Error("Failed to process AI feedback structure.");
        }
        // --- END ADDED CHECK ---


        // 4. Save to Database
        console.log("Attempting to save graded essay to DB..."); // Log before DB save
        const savedGradedEssay = await prisma.graded_essays.create({
             data: {
                 user_id: user.id,
                 essay_title: essayTitle?.trim() || `Graded Essay - ${new Date().toLocaleDateString()}`,
                 essay_content: essayText, // Save the original essay
                 rubric_or_criteria: rubricText,
                 // Safely access properties now after the check above
                 feedback: aiResult.feedback as Prisma.JsonObject, // Save the new structured feedback
                 score: aiResult.score,
             },
             select: { id: true, graded_at: true }
         });
         console.log("Saved graded essay to DB:", savedGradedEssay.id); // Log after DB save


        // 5. Increment AI Usage Count
        console.log("Attempting to update AI usage..."); // Log before usage update
        await updateAIUsage(user.id, new Date(), 1);
        console.log("Finished updating AI usage."); // Log after usage update


        // 6. Prepare and Return Response Data
        // Safely access properties now after the check above
        const responseData: GradeEssayResponseData = {
            id: savedGradedEssay.id,
            feedback: aiResult.feedback,
            score: aiResult.score,
            suggestions: aiResult.suggestions,
            graded_at: savedGradedEssay.graded_at?.toISOString() || '',
            essay_content: essayText, // --- ADDED: Return the essay content ---
        };
        return NextResponse.json<ApiResponse<GradeEssayResponseData>>({
            success: true,
            data: responseData,
            message: 'Essay graded successfully.'
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors

        // Log the specific error that was caught
        console.error('Error caught in /api/grade-essay POST handler:', error);

        // Handle specific known errors
        if (error.message?.includes("AI usage")) {
             console.error("Critical error: Failed to update AI usage count:", error.message);
             // Decide response: maybe return success but with a warning?
             // Or fail the request
             return NextResponse.json<ApiResponse>({ success: false, error: "Failed to update usage count after grading." }, { status: 500 });
        }
         if (error.message?.includes("AI grading failed:") || error.message?.includes("AI Error:")) {
             return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 502 }); // Bad Gateway for AI issues
        }
         if (error.message?.includes("Failed to process AI feedback structure.")) {
             return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 500 }); // Internal error processing AI response
         }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             console.error('Prisma Error saving graded essay:', { code: error.code, meta: error.meta });
             return NextResponse.json<ApiResponse>({ success: false, error: 'Database error occurred while saving feedback.' }, { status: 500 });
        }

        // Generic error
        const errorMessage = error.message || 'Failed to grade essay';
        const status = (error.message.includes("limit") || error.message.includes("characters required") || error.message.includes("Invalid file type") || error.message.includes("Unsupported Content-Type")) ? 400 : 500;
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status });
    }
}