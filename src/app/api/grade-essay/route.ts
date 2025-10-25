// src/app/api/grade-essay/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit } from '@/lib/usage-limits';
// REMOVE: import { createSupabaseServerClient } from '@/lib/getServerSession'; // No longer needed here
import { supabaseAdmin } from '@/lib/supabaseAdmin'; // Import the new admin client
import { ApiResponse, GradeEssayData, GradeEssayResponseData, GradedEssayFeedback } from '@/types/database';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Prisma } from '@prisma/client';
import pdfParse from 'pdf-parse-fork';
import { cleanExtractedText } from '@/lib/file-parser';

export const runtime = 'nodejs';

// --- AI Configuration, Prompt Building, AI Call Helpers remain the same ---
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-2.5-flash-lite";
const generationConfig = { /* ... */ };
const safetySettings = [ /* ... */ ];
interface AIGradedEssayResponse { /* ... */ }
function buildAIPrompt(essayText: string, rubricText?: string): string { /* ... */ }
async function callAIToGradeEssay(essayText: string, rubricText?: string): Promise<AIGradedEssayResponse> { /* ... */ }

// --- Helper to Update AI Usage using SERVICE ROLE ---
async function updateAIUsage(userId: string, month: Date, count: number = 1) {
    if (count <= 0) return;

    const firstDayOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
        .toISOString().split('T')[0];

    // Use the supabaseAdmin client (bypasses RLS)
    const supabase = supabaseAdmin; // Use the imported admin client

    try {
        console.log(`[Admin] Attempting to fetch AI usage for ${userId} month ${firstDayOfMonth}`);
        // Fetch requires specifying the user_id in the filter
        const { data: currentUsage, error: fetchError } = await supabase
            .from('ai_usage')
            .select('usage_count')
            .eq('user_id', userId) // Filter by user_id
            .eq('usage_month', firstDayOfMonth)
            .maybeSingle();

        // Use a consistent error handling function if desired, or handle directly
        if (fetchError && fetchError.code !== 'PGRST116') {
             console.error("[Admin] Supabase fetch error (updateAIUsage):", fetchError);
             throw new Error(`Failed fetching current AI usage: ${fetchError.message} (Code: ${fetchError.code})`);
        }

        const currentCount = currentUsage?.usage_count ?? 0;
        const newCount = currentCount + count;

        console.log(`[Admin] Attempting to upsert AI usage for ${userId} month ${firstDayOfMonth} to ${newCount}`);
        // Upsert requires user_id in the data
        const { error: upsertError } = await supabase
            .from('ai_usage')
            .upsert(
                {
                    user_id: userId, // Ensure user_id is included
                    usage_month: firstDayOfMonth,
                    usage_count: newCount,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id, usage_month' }
            );

         if (upsertError) {
             console.error("[Admin] Supabase upsert error (updateAIUsage):", upsertError);
             throw new Error(`Failed upserting AI usage: ${upsertError.message} (Code: ${upsertError.code})`);
         }

        console.log(`[Admin] Successfully updated AI usage for ${userId} in ${firstDayOfMonth}.`);

    } catch (error) {
        console.error(`[Admin] Error during AI usage update logic for user ${userId}:`, error);
        throw error; // Re-throw error to be caught by the main handler
    }
}


// --- POST Handler ---
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request); // Authentication confirmed here

        // 1. Check AI Usage Limits (remains the same)
        const usageCheck = await checkAIGenerationUsageLimit(user.id);
        if (!usageCheck.isValid || !usageCheck.canGenerate) {
            return NextResponse.json<ApiResponse>({ success: false, error: usageCheck.error, message: usageCheck.message }, { status: 403 });
        }

        // 2. Handle Input (JSON or File Upload - remains the same)
        let essayText: string = "";
        let rubricText: string | undefined = undefined;
        let essayTitle: string | undefined = undefined;
        const MAX_FILE_SIZE = 3 * 1024 * 1024;
        // ... (logic for handling contentType, formData, json body) ...
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData(); const file = formData.get('file') as File | null; rubricText = formData.get('rubricText')?.toString() ?? undefined; essayTitle = formData.get('essayTitle')?.toString() ?? undefined; if (!file) throw new Error("No file provided."); /* ... file validation ... */ const fileBuffer = Buffer.from(await file.arrayBuffer()); try { if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith(".pdf")) { essayText = (await pdfParse(fileBuffer)).text || ''; } else { essayText = fileBuffer.toString('utf8'); } essayText = cleanExtractedText(essayText); if (!essayTitle) essayTitle = file.name; } catch (e:any) { throw new Error(`Failed to extract text: ${e.message}`); }
        } else if (contentType.includes("application/json")) { const body: GradeEssayData = await request.json(); essayText = body.essayText; rubricText = body.rubricText; essayTitle = body.essayTitle; } else { throw new Error("Unsupported Content-Type."); }
        if (!essayText || essayText.trim().length < 50) { throw new Error("Essay text is too short (minimum 50 characters required)."); }


        // 3. Call AI to Grade Essay (remains the same)
        const aiResult = await callAIToGradeEssay(essayText, rubricText);

        // 4. Save to Database (remains the same)
        const savedGradedEssay = await prisma.graded_essays.create({
             data: { user_id: user.id, essay_title: essayTitle?.trim() || `Graded Essay - ${new Date().toLocaleDateString()}`, essay_content: essayText, rubric_or_criteria: rubricText, feedback: aiResult.feedback as Prisma.JsonObject, score: aiResult.score, }, select: { id: true, graded_at: true }
         });

        // 5. Increment AI Usage Count (using the updated helper)
        await updateAIUsage(user.id, new Date(), 1);

        // 6. Prepare and Return Response Data (remains the same)
        const responseData: GradeEssayResponseData = { id: savedGradedEssay.id, feedback: aiResult.feedback, score: aiResult.score, suggestions: aiResult.suggestions, graded_at: savedGradedEssay.graded_at?.toISOString() || '', };
        return NextResponse.json<ApiResponse<GradeEssayResponseData>>({ success: true, data: responseData, message: 'Essay graded successfully.' });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors
        console.error('Error in /api/grade-essay:', error);

        // Check if error came from updateAIUsage and log differently if needed
        if (error.message?.includes("AI usage")) {
             console.error("Critical error: Failed to update AI usage count:", error.message);
             // Decide if you still want to return success to the user, as grading *did* work
             // For now, let it fall through to the generic error
        }
         if (error.message?.includes("AI grading failed:")) {
             return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 502 });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             return NextResponse.json<ApiResponse>({ success: false, error: 'Database error occurred while saving feedback.' }, { status: 500 });
        }
        // Generic error
        const errorMessage = error.message || 'Failed to grade essay';
        const status = (error.message.includes("limit") || error.message.includes("characters required") || error.message.includes("Invalid file type")) ? 400 : 500;
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status });
    }
}

// Ensure buildAIPrompt and callAIToGradeEssay functions are included as before
// ... (buildAIPrompt function) ...
// ... (callAIToGradeEssay function) ...