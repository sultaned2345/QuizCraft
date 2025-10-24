// lib/usage-limits.ts

import { createClient } from '@supabase/supabase-js'; // Import Supabase client if needed for direct counts

// Assume supabaseHelpers exists and has necessary functions,
// OR use Prisma directly if preferred for counts.
// For Prisma, you'd import the client: import { prisma } from './prisma';
import { supabaseHelpers } from './supabase'; // Keep if helpers are used
import { prisma } from './prisma'; // Add prisma import

interface ValidationResult {
  isValid: boolean;
  error?: string;
  message?: string;
}

// Export usage limits constants
export const USAGE_LIMITS = {
  FREE_NOTES: 10,
  FREE_QUIZZES: 5,
  FREE_AI_GENERATIONS: 3,
  FREE_FLASHCARD_DECKS: 5,         // New limit for decks
  FREE_TOTAL_FLASHCARDS: 100,      // New limit for total cards across all decks
  PRO_NOTES: Infinity,
  PRO_QUIZZES: Infinity,
  PRO_AI_GENERATIONS: Infinity,
  PRO_FLASHCARD_DECKS: Infinity,   // Pro limit for decks
  PRO_TOTAL_FLASHCARDS: Infinity, // Pro limit for cards
};

// --- Existing validation functions ---

export async function validateNoteCreation(userId: string): Promise<ValidationResult> {
  // ... (keep existing implementation, maybe adapt to use Prisma if switching)
   try {
    console.log('Validating note creation for user:', userId);
    const userProfile = await prisma.profiles.findUnique({ where: { id: userId }, select: { subscription_plan: true } });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';

    if (plan !== 'pro') {
      const currentCount = await prisma.notes.count({ where: { user_id: userId } });
      console.log('Current note count:', currentCount, '/', USAGE_LIMITS.FREE_NOTES);
      if (currentCount >= USAGE_LIMITS.FREE_NOTES) {
        return {
          isValid: false,
          error: 'Note limit reached',
          message: `You have reached the maximum number of notes (${USAGE_LIMITS.FREE_NOTES}) for free users. Upgrade to Pro for unlimited notes.`
        };
      }
    }
    return { isValid: true };
  } catch (error: any) {
    console.error('Validation error (notes):', error);
    return { isValid: true }; // Be permissive on error
  }
}

export async function validateQuizCreation(userId: string): Promise<ValidationResult> {
  // ... (keep existing implementation, maybe adapt to use Prisma)
  try {
    const userProfile = await prisma.profiles.findUnique({ where: { id: userId }, select: { subscription_plan: true } });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';

    if (plan !== 'pro') {
      const currentCount = await prisma.quiz.count({ where: { userId: userId } });
      if (currentCount >= USAGE_LIMITS.FREE_QUIZZES) {
        return {
          isValid: false,
          error: 'Quiz limit reached',
          message: `You have reached the maximum number of quizzes (${USAGE_LIMITS.FREE_QUIZZES}) for free users. Upgrade to Pro for unlimited quizzes.`
        };
      }
    }
    return { isValid: true };
  } catch (error: any) {
    console.error('Quiz validation error:', error);
    return { isValid: true }; // Be permissive on error
  }
}

// Function to get AI count might need Prisma adaptation if not using Supabase helpers
export async function checkAIGenerationUsageLimit(userId: string): Promise<ValidationResult & { canGenerate?: boolean; currentCount?: number; limit?: number }> {
    try {
        const userProfile = await prisma.profiles.findUnique({
            where: { id: userId },
            select: { subscription_plan: true }
        });
        const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
        const limit = plan === 'pro' ? USAGE_LIMITS.PRO_AI_GENERATIONS : USAGE_LIMITS.FREE_AI_GENERATIONS;

        if (plan === 'pro') {
            return { isValid: true, canGenerate: true, currentCount: undefined, limit };
        }

        // For free users, fetch count (adapt if ai_usage model is used with Prisma)
        // This assumes supabaseHelpers.getAIGenerationCount works or is adapted
        const currentCount = await supabaseHelpers.getAIGenerationCount(userId); // Or Prisma equivalent

        if (currentCount >= limit) {
            return {
                isValid: false,
                canGenerate: false,
                currentCount,
                limit,
                error: 'AI generation limit reached',
                message: `You have reached the maximum number of AI generations (${limit}) for free users. Upgrade to Pro for unlimited AI generations.`
            };
        }

        return { isValid: true, canGenerate: true, currentCount, limit };

    } catch (error: any) {
        console.error('AI generation validation error:', error);
        // Don't block on validation errors, allow generation but log the issue
        return { isValid: true, canGenerate: true, currentCount: undefined, limit: Infinity }; // Default to permissive on error
    }
}


// --- New validation functions for Flashcards ---

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
          message: `You have reached the maximum number of decks (${USAGE_LIMITS.FREE_FLASHCARD_DECKS}) for free users. Upgrade to Pro for unlimited decks.`
        };
      }
    }
    return { isValid: true };
  } catch (error: any) {
    console.error('Validation error (decks):', error);
    return { isValid: true }; // Be permissive on error
  }
}

export async function validateFlashcardCreation(userId: string): Promise<ValidationResult> {
    try {
        const userProfile = await prisma.profiles.findUnique({ where: { id: userId }, select: { subscription_plan: true } });
        const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';

        if (plan !== 'pro') {
            // Count total flashcards across all decks for the user
            const currentCount = await prisma.flashcards.count({
                where: {
                    deck: { // Navigate through the relation
                        user_id: userId
                    }
                }
            });

            if (currentCount >= USAGE_LIMITS.FREE_TOTAL_FLASHCARDS) {
                return {
                    isValid: false,
                    error: 'Flashcard limit reached',
                    message: `You have reached the maximum total number of flashcards (${USAGE_LIMITS.FREE_TOTAL_FLASHCARDS}) for free users. Upgrade to Pro for unlimited flashcards.`
                };
            }
        }
        return { isValid: true };
    } catch (error: any) {
        console.error('Validation error (flashcards):', error);
        return { isValid: true }; // Be permissive on error
    }
}


// Helper function to get remaining usage for a user (Adapt if needed)
export async function getUserUsage(userId: string) {
  // ... (keep existing implementation or adapt fully to Prisma)
   try {
    const userProfile = await prisma.profiles.findUnique({ where: { id: userId }, select: { subscription_plan: true } });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
    const isPro = plan === 'pro';

    const [notesCount, quizzesCount, aiGenerationCount, decksCount, flashcardsCount] = await Promise.all([
      prisma.notes.count({ where: { user_id: userId } }),
      prisma.quiz.count({ where: { userId: userId } }),
      supabaseHelpers.getAIGenerationCount(userId), // Keep or replace with Prisma if ai_usage is modeled
      prisma.flashcard_decks.count({ where: { user_id: userId } }),
      prisma.flashcards.count({ where: { deck: { user_id: userId } } }),
    ]);

    return {
      plan,
      notes: {
        used: notesCount,
        limit: isPro ? USAGE_LIMITS.PRO_NOTES : USAGE_LIMITS.FREE_NOTES,
        remaining: isPro ? Infinity : Math.max(0, USAGE_LIMITS.FREE_NOTES - notesCount)
      },
      quizzes: {
        used: quizzesCount,
        limit: isPro ? USAGE_LIMITS.PRO_QUIZZES : USAGE_LIMITS.FREE_QUIZZES,
        remaining: isPro ? Infinity : Math.max(0, USAGE_LIMITS.FREE_QUIZZES - quizzesCount)
      },
      aiGenerations: {
        used: aiGenerationCount,
        limit: isPro ? USAGE_LIMITS.PRO_AI_GENERATIONS : USAGE_LIMITS.FREE_AI_GENERATIONS,
        remaining: isPro ? Infinity : Math.max(0, USAGE_LIMITS.FREE_AI_GENERATIONS - aiGenerationCount)
      },
      flashcardDecks: { // New section
          used: decksCount,
          limit: isPro ? USAGE_LIMITS.PRO_FLASHCARD_DECKS : USAGE_LIMITS.FREE_FLASHCARD_DECKS,
          remaining: isPro ? Infinity : Math.max(0, USAGE_LIMITS.FREE_FLASHCARD_DECKS - decksCount)
      },
      flashcards: { // New section
          used: flashcardsCount,
          limit: isPro ? USAGE_LIMITS.PRO_TOTAL_FLASHCARDS : USAGE_LIMITS.FREE_TOTAL_FLASHCARDS,
          remaining: isPro ? Infinity : Math.max(0, USAGE_LIMITS.FREE_TOTAL_FLASHCARDS - flashcardsCount)
      }
    };
  } catch (error) {
    console.error('Error getting user usage:', error);
    // Return default free tier values on error, including flashcards
    return {
      plan: 'free',
      notes: { used: 0, limit: USAGE_LIMITS.FREE_NOTES, remaining: USAGE_LIMITS.FREE_NOTES },
      quizzes: { used: 0, limit: USAGE_LIMITS.FREE_QUIZZES, remaining: USAGE_LIMITS.FREE_QUIZZES },
      aiGenerations: { used: 0, limit: USAGE_LIMITS.FREE_AI_GENERATIONS, remaining: USAGE_LIMITS.FREE_AI_GENERATIONS },
      flashcardDecks: { used: 0, limit: USAGE_LIMITS.FREE_FLASHCARD_DECKS, remaining: USAGE_LIMITS.FREE_FLASHCARD_DECKS },
      flashcards: { used: 0, limit: USAGE_LIMITS.FREE_TOTAL_FLASHCARDS, remaining: USAGE_LIMITS.FREE_TOTAL_FLASHCARDS },
    };
  }
}