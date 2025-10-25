// lib/usage-limits.ts

// No Supabase client needed here if using Prisma for counts
// import { createClient } from '@supabase/supabase-js';

// Import Prisma client for database checks
import { prisma } from '@/lib/prisma';
// Import Supabase helpers *only* for AI usage functions if they still rely on Supabase RPC/tables
import { supabaseHelpers } from './supabase';

// Define the structure for validation results
interface ValidationResult {
  isValid: boolean;
  error?: string;
  message?: string;
}

// Export usage limits constants
export const USAGE_LIMITS = {
  // Free Tier Limits
  FREE_NOTES: 10,
  FREE_QUIZZES: 5,
  FREE_AI_GENERATIONS: 3, // Per calendar month
  FREE_FLASHCARD_DECKS: 5,
  FREE_TOTAL_FLASHCARDS: 100,
  FREE_DOCUMENTS: 5, // Assuming a document limit

  // Pro Tier Limits (Infinity represents unlimited)
  PRO_NOTES: Infinity,
  PRO_QUIZZES: Infinity,
  PRO_AI_GENERATIONS: Infinity,
  PRO_FLASHCARD_DECKS: Infinity,
  PRO_TOTAL_FLASHCARDS: Infinity,
  PRO_DOCUMENTS: Infinity,
};

// --- Validation Functions (Using Prisma) ---

export async function validateNoteCreation(userId: string): Promise<ValidationResult> {
   try {
    const userProfile = await prisma.profiles.findUnique({ where: { id: userId }, select: { subscription_plan: true } });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';

    if (plan !== 'pro') {
      const currentCount = await prisma.notes.count({ where: { user_id: userId } });
      if (currentCount >= USAGE_LIMITS.FREE_NOTES) {
        return {
          isValid: false,
          error: 'Note limit reached',
          message: `Max ${USAGE_LIMITS.FREE_NOTES} notes for free users. Upgrade for unlimited.`
        };
      }
    }
    return { isValid: true };
  } catch (error: any) {
    console.error('Validation error (notes):', error);
    return { isValid: true }; // Permissive on error
  }
}

export async function validateQuizCreation(userId: string): Promise<ValidationResult> {
  try {
    const userProfile = await prisma.profiles.findUnique({ where: { id: userId }, select: { subscription_plan: true } });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';

    if (plan !== 'pro') {
      // Ensure field name matches Prisma schema ('userId')
      const currentCount = await prisma.quiz.count({ where: { userId: userId } });
      if (currentCount >= USAGE_LIMITS.FREE_QUIZZES) {
        return {
          isValid: false,
          error: 'Quiz limit reached',
          message: `Max ${USAGE_LIMITS.FREE_QUIZZES} quizzes for free users. Upgrade for unlimited.`
        };
      }
    }
    return { isValid: true };
  } catch (error: any) {
    console.error('Quiz validation error:', error);
    return { isValid: true }; // Permissive on error
  }
}

// --- UPDATED AI Usage Check (Monthly Limit) ---
export async function checkAIGenerationUsageLimit(userId: string): Promise<ValidationResult & { canGenerate?: boolean; currentCount?: number; limit?: number | typeof Infinity }> { // Added typeof Infinity
    try {
        const userProfile = await prisma.profiles.findUnique({
            where: { id: userId },
            select: { subscription_plan: true }
        });
        const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
        const limit = plan === 'pro' ? USAGE_LIMITS.PRO_AI_GENERATIONS : USAGE_LIMITS.FREE_AI_GENERATIONS;

        // Pro users have no limit
        if (plan === 'pro') {
            // Ensure limit reflects Infinity for Pro plan
            return { isValid: true, canGenerate: true, currentCount: undefined, limit: Infinity };
        }

        // --- CHANGE: Use getAIGenerationUsageForMonth ---
        // Get usage count specifically for the current calendar month
        const currentMonth = new Date();
        // This helper still relies on Supabase client/RPC as defined in supabase.ts
        const currentCount = await supabaseHelpers.getAIGenerationUsageForMonth(userId, currentMonth);
        // ----------------------------------------------

        console.log(`AI Usage Check: User ${userId}, Month ${currentMonth.toISOString().slice(0, 7)}, Count ${currentCount}, Limit ${limit}`);

        // Check if the current month's count meets or exceeds the limit
        if (currentCount >= limit) {
            return {
                isValid: false,
                canGenerate: false,
                currentCount,
                limit, // Use the determined limit for the plan
                error: 'AI generation limit reached for this month',
                message: `You have reached the maximum number of AI generations (${limit}) for this calendar month on the free plan. Upgrade to Pro for unlimited AI generations.`
            };
        }

        // If limit not reached
        return { isValid: true, canGenerate: true, currentCount, limit }; // Use the determined limit

    } catch (error: any) {
        console.error('AI generation validation error:', error);
        // Default to permissive on error, but return the free limit for clarity
        return { isValid: true, canGenerate: true, currentCount: undefined, limit: USAGE_LIMITS.FREE_AI_GENERATIONS };
    }
}


// --- Flashcard Validations (Using Prisma) ---

export async function validateDeckCreation(userId: string): Promise<ValidationResult> {
  try {
    const userProfile = await prisma.profiles.findUnique({ where: { id: userId }, select: { subscription_plan: true } });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';

    if (plan !== 'pro') {
      const currentCount = await prisma.flashcard_decks.count({ where: { user_id: userId } });
      if (currentCount >= USAGE_LIMITS.FREE_FLASHCARD_DECKS) {
        return {
          isValid: false,
          error: 'Deck limit reached',
          message: `Max ${USAGE_LIMITS.FREE_FLASHCARD_DECKS} decks for free users. Upgrade for unlimited.`
        };
      }
    }
    return { isValid: true };
  } catch (error: any) {
    console.error('Validation error (decks):', error);
    return { isValid: true }; // Permissive on error
  }
}

export async function validateFlashcardCreation(userId: string): Promise<ValidationResult> {
    try {
        const userProfile = await prisma.profiles.findUnique({ where: { id: userId }, select: { subscription_plan: true } });
        const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';

        if (plan !== 'pro') {
            // Count total flashcards across all decks for the user using Prisma relation count
            const currentCount = await prisma.flashcards.count({
                where: { deck: { user_id: userId } } // Filter based on the related deck's user_id
            });

            if (currentCount >= USAGE_LIMITS.FREE_TOTAL_FLASHCARDS) {
                return {
                    isValid: false,
                    error: 'Total flashcard limit reached',
                    message: `Max ${USAGE_LIMITS.FREE_TOTAL_FLASHCARDS} total flashcards for free users. Upgrade for unlimited.`
                };
            }
        }
        return { isValid: true };
    } catch (error: any) {
        console.error('Validation error (flashcards):', error);
        return { isValid: true }; // Permissive on error
    }
}

// --- Document Validation (Using Prisma) ---
export async function validateDocumentUpload(userId: string): Promise<ValidationResult> {
    try {
        const userProfile = await prisma.profiles.findUnique({ where: { id: userId }, select: { subscription_plan: true } });
        const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';

        if (plan !== 'pro') {
            const currentCount = await prisma.documents.count({ where: { user_id: userId } });
            if (currentCount >= USAGE_LIMITS.FREE_DOCUMENTS) {
                return {
                    isValid: false,
                    error: 'Document limit reached',
                    message: `Max ${USAGE_LIMITS.FREE_DOCUMENTS} documents for free users. Upgrade for unlimited.`
                };
            }
        }
        return { isValid: true };
    } catch (error: any) {
        console.error('Validation error (documents):', error);
        return { isValid: true }; // Permissive on error
    }
}


// --- Helper function to get combined usage stats ---
// (Note: This still uses supabaseHelpers for AI count, adapt if AI usage is moved to Prisma)
export async function getUserUsage(userId: string) {
   try {
    const userProfile = await prisma.profiles.findUnique({ where: { id: userId }, select: { subscription_plan: true } });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
    const isPro = plan === 'pro';

    // Fetch counts using Prisma and Supabase helper for AI
    const [
        notesCount,
        quizzesCount,
        // --- CHANGE: Fetch current month's AI count for display ---
        aiGenerationCountThisMonth,
        // ----------------------------------------------------
        decksCount,
        flashcardsCount,
        documentsCount // Added documents count
    ] = await Promise.all([
      prisma.notes.count({ where: { user_id: userId } }),
      prisma.quiz.count({ where: { userId: userId } }), // Ensure field name matches schema
      supabaseHelpers.getAIGenerationUsageForMonth(userId, new Date()), // Get current month's count
      prisma.flashcard_decks.count({ where: { user_id: userId } }),
      prisma.flashcards.count({ where: { deck: { user_id: userId } } }),
      prisma.documents.count({ where: { user_id: userId } }), // Fetch document count
    ]);

    // Define limits based on plan
    const noteLimit = isPro ? USAGE_LIMITS.PRO_NOTES : USAGE_LIMITS.FREE_NOTES;
    const quizLimit = isPro ? USAGE_LIMITS.PRO_QUIZZES : USAGE_LIMITS.FREE_QUIZZES;
    const aiLimit = isPro ? USAGE_LIMITS.PRO_AI_GENERATIONS : USAGE_LIMITS.FREE_AI_GENERATIONS;
    const deckLimit = isPro ? USAGE_LIMITS.PRO_FLASHCARD_DECKS : USAGE_LIMITS.FREE_FLASHCARD_DECKS;
    const cardLimit = isPro ? USAGE_LIMITS.PRO_TOTAL_FLASHCARDS : USAGE_LIMITS.FREE_TOTAL_FLASHCARDS;
    const docLimit = isPro ? USAGE_LIMITS.PRO_DOCUMENTS : USAGE_LIMITS.FREE_DOCUMENTS; // Added doc limit

    return {
      plan,
      notes: {
        used: notesCount,
        limit: noteLimit,
        remaining: isPro ? Infinity : Math.max(0, noteLimit - notesCount)
      },
      quizzes: {
        used: quizzesCount,
        limit: quizLimit,
        remaining: isPro ? Infinity : Math.max(0, quizLimit - quizzesCount)
      },
      aiGenerations: { // Display current month's usage vs monthly limit
        used: aiGenerationCountThisMonth,
        limit: aiLimit,
        remaining: isPro ? Infinity : Math.max(0, aiLimit - aiGenerationCountThisMonth)
      },
      flashcardDecks: {
          used: decksCount,
          limit: deckLimit,
          remaining: isPro ? Infinity : Math.max(0, deckLimit - decksCount)
      },
      flashcards: { // Total flashcards vs total limit
          used: flashcardsCount,
          limit: cardLimit,
          remaining: isPro ? Infinity : Math.max(0, cardLimit - flashcardsCount)
      },
      documents: { // Added documents usage
          used: documentsCount,
          limit: docLimit,
          remaining: isPro ? Infinity : Math.max(0, docLimit - documentsCount)
      }
    };
  } catch (error) {
    console.error('Error getting user usage:', error);
    // Return default free tier values on error, including documents
    return {
      plan: 'free',
      notes: { used: 0, limit: USAGE_LIMITS.FREE_NOTES, remaining: USAGE_LIMITS.FREE_NOTES },
      quizzes: { used: 0, limit: USAGE_LIMITS.FREE_QUIZZES, remaining: USAGE_LIMITS.FREE_QUIZZES },
      aiGenerations: { used: 0, limit: USAGE_LIMITS.FREE_AI_GENERATIONS, remaining: USAGE_LIMITS.FREE_AI_GENERATIONS },
      flashcardDecks: { used: 0, limit: USAGE_LIMITS.FREE_FLASHCARD_DECKS, remaining: USAGE_LIMITS.FREE_FLASHCARD_DECKS },
      flashcards: { used: 0, limit: USAGE_LIMITS.FREE_TOTAL_FLASHCARDS, remaining: USAGE_LIMITS.FREE_TOTAL_FLASHCARDS },
      documents: { used: 0, limit: USAGE_LIMITS.FREE_DOCUMENTS, remaining: USAGE_LIMITS.FREE_DOCUMENTS },
    };
  }
}