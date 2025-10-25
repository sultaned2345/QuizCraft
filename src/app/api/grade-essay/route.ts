// src/app/api/grade-essay/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit } from '@/lib/usage-limits';
// REMOVE: import { supabaseHelpers } from '@/lib/supabase'; // No longer needed for incrementing
import { createSupabaseServerClient } from '@/lib/getServerSession'; // Import server client creator
import { ApiResponse, GradeEssayData, GradeEssayResponseData, GradedEssayFeedback } from '@/types/database';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google-generative-ai";
import { Prisma } from '@prisma/client';
import pdfParse from 'pdf-parse-fork';
import { cleanExtractedText } from '@/lib/file-parser';

export const runtime = 'nodejs';

// --- AI Configuration, Prompt Building, AI Call Helpers remain the same ---
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-2.5-flash-lite";
// ... (generationConfig, safetySettings) ...
// ... (AIGradedEssayResponse interface) ...
// ... (buildAIPrompt function) ...
// ... (callAIToGradeEssay function) ...

// --- Helper to Update AI Usage directly ---
async function updateAIUsage(userId: string, month: Date, count: number = 1) {
    if (count <= 0) return;

    const firstDayOfMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1))
        .toISOString().split('T')[0];

    // Create a server client WITH user context (relies on cookies being handled by @supabase/ssr)
    const supabase = createSupabaseServerClient(); // From getServerSession.ts

    try {
        console.log(`Attempting to fetch AI usage for ${userId} month ${firstDayOfMonth}`);
        const { data: currentUsage, error: fetchError } = await supabase
            .from('ai_usage')
            .select('usage_count')
            .eq('user_id', userId)
            .eq('usage_month', firstDayOfMonth)
            .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
             console.error("Supabase fetch error (updateAIUsage):", fetchError);
             throw new Error(`Failed fetching current AI usage: ${fetchError.message} (Code: ${fetchError.code})`);
        }

        const currentCount = currentUsage?.usage_count ?? 0;
        const newCount = currentCount + count;

        console.log(`Attempting to upsert AI usage for ${userId} month ${firstDayOfMonth} to ${newCount}`);
        const { error: upsertError } = await supabase
            .from('ai_usage')
            .upsert(
                {
                    user_id: userId,
                    usage_month: firstDayOfMonth,
                    usage_count: newCount,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id, usage_month' }
            );

         if (upsertError) {
             console.error("Supabase upsert error (updateAIUsage):", upsertError);
             throw new Error(`Failed upserting AI usage: ${upsertError.message} (Code: ${upsertError.code})`);
         }

        console.log(`Successfully updated AI usage for ${userId} in ${firstDayOfMonth}.`);

    } catch (error) {
        console.error(`Error during AI usage update logic for user ${userId}:`, error);
        // Log error but maybe don't fail the entire request? Or re-throw if critical.
        // For now, re-throwing to make sure we see the failure.
        throw error;
    }
}


// --- POST Handler ---
export async function POST(request: NextRequest) {
    try {
        const user = await requireAuth(request); // Still needed to get user ID initially

        // 1. Check AI Usage Limits (remains the same)
        const usageCheck = await checkAIGenerationUsageLimit(user.id);
        // ... (limit check logic) ...
        if (!usageCheck.isValid || !usageCheck.canGenerate) {
            return NextResponse.json<ApiResponse>({ success: false, error: usageCheck.error, message: usageCheck.message }, { status: 403 });
        }

        // 2. Handle Input (JSON or File Upload - remains the same)
        // ... (logic for handling contentType, formData, json body) ...
        let essayText: string = "";
        let rubricText: string | undefined = undefined;
        let essayTitle: string | undefined = undefined;
        const MAX_FILE_SIZE = 3 * 1024 * 1024;
        const contentType = request.headers.get("content-type") || "";
        if (contentType.includes("multipart/form-data")) { /* ... extract from form ... */ }
        else if (contentType.includes("application/json")) { /* ... extract from json ... */ }
        else { throw new Error("Unsupported Content-Type."); }
        if (!essayText || essayText.trim().length < 50) { throw new Error("Essay text is too short (minimum 50 characters required)."); }


        // 3. Call AI to Grade Essay (remains the same)
        const aiResult = await callAIToGradeEssay(essayText, rubricText);

        // 4. Save to Database (remains the same)
        const savedGradedEssay = await prisma.graded_essays.create({ /* ... prisma create logic ... */
             data: { user_id: user.id, essay_title: essayTitle?.trim() || `Graded Essay - ${new Date().toLocaleDateString()}`, essay_content: essayText, rubric_or_criteria: rubricText, feedback: aiResult.feedback as Prisma.JsonObject, score: aiResult.score, }, select: { id: true, graded_at: true }
         });

        // 5. Increment AI Usage Count (using NEW direct method)
        await updateAIUsage(user.id, new Date(), 1); // Call the new helper within this file

        // 6. Prepare and Return Response Data (remains the same)
        // ... (prepare responseData) ...
        const responseData: GradeEssayResponseData = { id: savedGradedEssay.id, feedback: aiResult.feedback, score: aiResult.score, suggestions: aiResult.suggestions, graded_at: savedGradedEssay.graded_at?.toISOString() || '', };
        return NextResponse.json<ApiResponse<GradeEssayResponseData>>({ success: true, data: responseData, message: 'Essay graded successfully.' });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors
        console.error('Error in /api/grade-essay:', error);
        // More detailed error checking based on where the error originated (AI, DB save, Usage update)
        if (error.message?.includes("AI grading failed:")) {
             return NextResponse.json<ApiResponse>({ success: false, error: error.message }, { status: 502 });
        }
        if (error.message?.includes("AI usage")) { // Check for errors from updateAIUsage
             // Log it but maybe return success anyway, as grading worked? Or return specific error.
             console.error("Failed to update AI usage, but grading succeeded:", error.message);
             // Optionally return a specific status or just proceed
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
             // ... prisma error handling ...
             return NextResponse.json<ApiResponse>({ success: false, error: 'Database error occurred while saving feedback.' }, { status: 500 });
        }
        // Generic error
        const errorMessage = error.message || 'Failed to grade essay';
        const status = (error.message.includes("limit") || error.message.includes("characters required") || error.message.includes("Invalid file type")) ? 400 : 500;
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status });
    }
}