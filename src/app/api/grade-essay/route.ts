// src/app/api/grade-essay/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkAIGenerationUsageLimit, incrementAIGenerationUsage } from '@/lib/usage-limits';
import { 
    ApiResponse, 
    GradeEssayData, 
    GradeEssayResponseData, 
    RubricSettings 
} from '@/types/database';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// --- AI Configuration ---
const API_KEY = process.env.GOOGLE_AI_API_KEY || "";
const AI_MODEL_NAME = "gemini-2.0-flash"; // Upgraded to latest model for better JSON adherence

const WORD_LIMIT = 3000;
const countWords = (text: string): number => {
  if (!text.trim()) return 0;
  return text.trim().split(/\s+/).length;
};

const generationConfig = {
  temperature: 0.4, // Lower temperature for more consistent JSON and grading
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 8192,
  responseMimeType: "application/json",
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

function buildAIPrompt(essayText: string, rubricText?: string, settings?: RubricSettings): string {
    // 1. Define Persona based on settings
    const level = settings?.academicLevel || 'Undergraduate';
    const tone = settings?.tone || 'Formal';
    const strictness = settings?.strictness || 'Standard';

    const persona = `You are a ${strictness}, expert writing professor grading a ${level} level essay. Your tone should be ${tone}. 
    Your goal is to provide specific, actionable feedback that helps the student improve their writing mechanics and argumentation.`;

    // 2. Define Output Requirements
    const baseInstruction = `
    Analyze the essay below. You MUST return valid JSON matching the schema provided.
    
    1. **Thesis Detection**: Identify the thesis statement. If found, extract it and critique it. If not found, explicitly state that.
    2. **Highlights**: For every category (Clarify, Argument, Grammar), find specific text snippets to highlight.
       - 'type': Must be 'error' (red), 'warning' (yellow), or 'praise' (green).
       - 'replacement': If it is an error or improvement, provide the CORRECTED text for that specific snippet. If it is praise, leave this empty.
    3. **Scoring**:
       - 'High School': Be more lenient. 
       - 'Undergraduate': Standard academic rigor.
       - 'Graduate': High expectations for nuance and research.
       - 'Strict' mode: Deduct points heavily for grammar and logic gaps.
    `;

     const rubricInstruction = rubricText 
       ? `Use these specific user-provided grading criteria:\n"""\n${rubricText}\n"""\n` 
       : `Evaluate based on standard academic criteria for ${level} level writing.`;

     const outputFormat = `Return ONLY valid JSON in this exact shape:
{
  "score": 88,
  "feedback": {
    "thesis": {
      "detected": true,
      "statement": "The extracted thesis text found in the essay...",
      "critique": "Strong argument, but could be more specific about..."
    },
    "strengths": {
      "summary": "You have a compelling voice...",
      "highlights": [
        {
            "text": "exact snippet from essay", 
            "comment": "Excellent use of metaphor here.",
            "type": "praise"
        }
      ]
    },
    "clarity": {
      "summary": "Some sentences are convoluted...",
      "highlights": [
        {
            "text": "The usage of the thing which is...", 
            "comment": "Passive and wordy. Simplify this.", 
            "type": "warning",
            "replacement": "Using this object..."
        }
      ]
    },
    "argument": {
      "summary": "Your logic holds up well, but...",
      "highlights": []
    },
    "grammar": {
      "summary": "Watch out for comma splices...",
      "highlights": [
         {
            "text": "students, who are smart", 
            "comment": "Unnecessary comma.", 
            "type": "error",
            "replacement": "students who are smart"
         }
      ]
    },
    "summary": "Overall, a strong effort..."
  },
  "suggestions": [
    "Refine your thesis to include...",
    "Review comma usage rules."
  ]
}`;

     return `${persona}\n\n${baseInstruction}\n\n${rubricInstruction}\n\nEssay Text:\n"""\n${essayText}\n"""\n\n${outputFormat}`;
}

async function callAIToGradeEssay(essayText: string, rubricText?: string, settings?: RubricSettings) {
    if (!API_KEY) throw new Error("Missing GOOGLE_AI_API_KEY"); 
    
    const genAI = new GoogleGenerativeAI(API_KEY); 
    const model = genAI.getGenerativeModel({ model: AI_MODEL_NAME, generationConfig, safetySettings }); 
    const prompt = buildAIPrompt(essayText, rubricText, settings); 
    
    try { 
        console.log(`Sending prompt to AI model: ${AI_MODEL_NAME} for grading...`); 
        const result = await model.generateContent(prompt); 
        const response = await result.response; 
        const content = response.text(); 
        
        if (!content) throw new Error("Empty response from AI model."); 
        
        let parsed; 
        try { 
            parsed = JSON.parse(content); 
        } catch (jsonError) { 
            console.error("Failed to parse AI JSON response:", content); 
            // Attempt to clean markdown code blocks if present
            const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
            try {
                parsed = JSON.parse(cleanContent);
            } catch (e) {
                 throw new Error("AI returned invalid JSON format."); 
            }
        } 
    
        if (!parsed || typeof parsed !== 'object') throw new Error("AI response is not a valid object."); 
        if (!parsed.feedback || typeof parsed.feedback !== 'object') throw new Error("AI response missing 'feedback' object."); 
    
        // Ensure structure for new fields
        const categories = ['strengths', 'clarity', 'argument', 'grammar'];
        for (const cat of categories) {
            if (!parsed.feedback[cat]) {
                 parsed.feedback[cat] = { summary: `No specific feedback for ${cat}.`, highlights: [] };
            }
            // Ensure highlights have new fields if missing
            if (Array.isArray(parsed.feedback[cat].highlights)) {
                parsed.feedback[cat].highlights = parsed.feedback[cat].highlights.map((h: any) => ({
                    ...h,
                    type: h.type || 'neutral',
                    replacement: h.replacement || undefined
                }));
            }
        }
        
        if (!parsed.feedback.thesis) {
            parsed.feedback.thesis = { detected: false, critique: "No thesis analysis provided." };
        }

        if (typeof parsed.score !== 'number' && parsed.score !== null) parsed.score = null; 
        
        return parsed; 
    } catch (error: any) { 
        console.error(`AI Grading Error:`, error); 
        throw new Error(`AI grading failed: ${error.message}`); 
    }
}

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
        const body: GradeEssayData = await request.json(); 
        const { essayText, rubricText, essayTitle, rubricSettings } = body;
        
        if (!essayText || essayText.trim().length < 50) { 
            throw new Error("Essay text is too short (minimum 50 characters required)."); 
        }

        const wordCount = countWords(essayText);
        if (wordCount > WORD_LIMIT) {
            throw new Error(`Essay exceeds the ${WORD_LIMIT} word limit. You submitted ${wordCount} words.`);
        }

        // 3. Call AI
        const aiResult = await callAIToGradeEssay(essayText, rubricText, rubricSettings);

        // 4. Save to Database
        console.log("Saving graded essay to DB...");
        const savedGradedEssay = await prisma.graded_essays.create({
             data: {
                 user_id: user.id,
                 essay_title: essayTitle?.trim() || `Graded Essay - ${new Date().toLocaleDateString()}`,
                 essay_content: essayText,
                 rubric_or_criteria: rubricText,
                 // Store the full feedback object including thesis and settings
                 feedback: aiResult.feedback as unknown as Prisma.JsonObject,
                 score: aiResult.score,
             },
             select: { id: true, graded_at: true }
         });

        // 5. Increment Usage
        await incrementAIGenerationUsage(user.id, 1);

        // 6. Return Response
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
        console.error('Error in /api/grade-essay:', error);

        const status = (error.message.includes("limit") || error.message.includes("short")) ? 400 : 500;
        return NextResponse.json<ApiResponse>({ success: false, error: error.message || 'Failed to grade essay' }, { status });
    }
}