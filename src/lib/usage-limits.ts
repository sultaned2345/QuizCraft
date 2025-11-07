// src/lib/usage-limits.ts

import { prisma } from '@/lib/prisma';
// --- MODIFIED: Removed supabaseHelpers import ---
// import { supabaseHelpers } from './supabase'; // Import the helpers
import { supabaseAdmin } from './supabaseAdmin'; // --- ADDED: For getAIGenerationUsageForMonth ---
import { Prisma } from '@prisma/client'; // <-- ADDED: For error handling

interface ValidationResult {
  isValid: boolean;
  error?: string; // <-- This will be our consistent error code
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
  FREE_DOCUMENTS: 5,

  // Pro Tier Limits (Infinity represents unlimited)
  PRO_NOTES: Infinity,
  PRO_QUIZZES: Infinity,
  PRO_AI_GENERATIONS: Infinity,
  PRO_FLASHCARD_DECKS: Infinity,
  PRO_TOTAL_FLASHCARDS: Infinity,
  PRO_DOCUMENTS: Infinity,
};

// --- NEW SERVER-SIDE HELPER (Moved from supabase.ts) ---
async function getAIGenerationUsageForMonth(
  userId: string,
  month: Date
): Promise<number> {
  const firstDayOfMonth = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1)
  )
    .toISOString()
    .split('T')[0];

  try {
    // --- MODIFIED: Use Prisma ---
    const usage = await prisma.ai_usage.findUnique({
      where: {
        user_id_usage_month: {
          user_id: userId,
          usage_month: new Date(firstDayOfMonth),
        },
      },
      select: {
        usage_count: true,
      },
    });
    return usage?.usage_count ?? 0;
    // ---
  } catch (error) {
    console.error(
      `Error getting AI generation usage for month ${firstDayOfMonth}:`,
      error
    );
    return 0;
  }
}

// --- Validation Functions (Using Prisma) ---
// (validateNoteCreation, validateQuizCreation remain unchanged)
export async function validateNoteCreation(
  userId: string
): Promise<ValidationResult> {
  try {
    const userProfile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { subscription_plan: true },
    });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';

    if (plan !== 'pro') {
      const currentCount = await prisma.notes.count({
        where: { user_id: userId },
      });
      if (currentCount >= USAGE_LIMITS.FREE_NOTES) {
        return {
          isValid: false,
          error: 'limit_exceeded', // <-- STANDARDIZED ERROR
          message: `Max ${USAGE_LIMITS.FREE_NOTES} notes for free users. Upgrade for unlimited.`,
        };
      }
    }
    return { isValid: true };
  } catch (error: any) {
    console.error('Validation error (notes):', error);
    return { isValid: true }; // Permissive on error
  }
}

export async function validateQuizCreation(
  userId: string
): Promise<ValidationResult> {
  try {
    const userProfile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { subscription_plan: true },
    });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';

    if (plan !== 'pro') {
      const currentCount = await prisma.quiz.count({
        where: { userId: userId },
      });
      if (currentCount >= USAGE_LIMITS.FREE_QUIZZES) {
        return {
          isValid: false,
          error: 'limit_exceeded', // <-- STANDARDIZED ERROR
          message: `Max ${USAGE_LIMITS.FREE_QUIZZES} quizzes for free users. Upgrade for unlimited.`,
        };
      }
    }
    return { isValid: true };
  } catch (error: any) {
    console.error('Quiz validation error:', error);
    return { isValid: true }; // Permissive on error
  }
}
// ---

// --- UPDATED AI Usage Check (Monthly Limit) ---
export async function checkAIGenerationUsageLimit(
  userId: string
): Promise<
  ValidationResult & {
    canGenerate?: boolean;
    currentCount?: number;
    limit?: number | typeof Infinity;
  }
> {
  try {
    const userProfile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { subscription_plan: true },
    });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
    const limit =
      plan === 'pro'
        ? USAGE_LIMITS.PRO_AI_GENERATIONS
        : USAGE_LIMITS.FREE_AI_GENERATIONS;

    if (plan === 'pro') {
      return {
        isValid: true,
        canGenerate: true,
        currentCount: undefined,
        limit: Infinity,
      };
    }

    // --- MODIFIED: Call local function ---
    const currentMonth = new Date();
    const currentCount = await getAIGenerationUsageForMonth(userId, currentMonth);
    // ----------------------------------------

    console.log(
      `AI Usage Check: User ${userId}, Month ${currentMonth
        .toISOString()
        .slice(0, 7)}, Count ${currentCount}, Limit ${limit}`
    );

    if (currentCount >= limit) {
      return {
        isValid: false,
        canGenerate: false,
        currentCount,
        limit,
        error: 'limit_exceeded', // <-- STANDARDIZED ERROR
        message: `You have reached the maximum number of AI generations (${limit}) for this calendar month on the free plan. Upgrade to Pro for unlimited AI generations.`,
      };
    }

    return { isValid: true, canGenerate: true, currentCount, limit };
  } catch (error: any) {
    console.error('AI generation validation error:', error);
    return {
      isValid: true,
      canGenerate: true,
      currentCount: undefined,
      limit: USAGE_LIMITS.FREE_AI_GENERATIONS,
    };
  }
}

// --- Flashcard Validations (Using Prisma) ---
// (validateDeckCreation, validateFlashcardCreation, validateDocumentUpload, getUserUsage remain unchanged)
export async function validateDeckCreation(
  userId: string
): Promise<ValidationResult> {
  try {
    const userProfile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { subscription_plan: true },
    });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';

    if (plan !== 'pro') {
      const currentCount = await prisma.flashcard_decks.count({
        where: { user_id: userId },
      });
      if (currentCount >= USAGE_LIMITS.FREE_FLASHCARD_DECKS) {
        return {
          isValid: false,
          error: 'limit_exceeded', // <-- STANDARDIZED ERROR
          message: `Max ${USAGE_LIMITS.FREE_FLASHCARD_DECKS} decks for free users. Upgrade for unlimited.`,
        };
      }
    }
    return { isValid: true };
  } catch (error: any) {
    console.error('Validation error (decks):', error);
    return { isValid: true }; // Permissive on error
  }
}

export async function validateFlashcardCreation(
  userId: string
): Promise<ValidationResult> {
  try {
    const userProfile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { subscription_plan: true },
    });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';

    if (plan !== 'pro') {
      const currentCount = await prisma.flashcards.count({
        where: { deck: { user_id: userId } },
      });

      if (currentCount >= USAGE_LIMITS.FREE_TOTAL_FLASHCARDS) {
        return {
          isValid: false,
          error: 'limit_exceeded', // <-- STANDARDIZED ERROR
          message: `Max ${USAGE_LIMITS.FREE_TOTAL_FLASHCARDS} total flashcards for free users. Upgrade for unlimited.`,
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
export async function validateDocumentUpload(
  userId: string
): Promise<ValidationResult> {
  try {
    const userProfile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { subscription_plan: true },
    });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';

    if (plan !== 'pro') {
      const currentCount = await prisma.documents.count({
        where: { user_id: userId },
      });
      if (currentCount >= USAGE_LIMITS.FREE_DOCUMENTS) {
        return {
          isValid: false,
          error: 'limit_exceeded', // <-- STANDARDIZED ERROR
          message: `Max ${USAGE_LIMITS.FREE_DOCUMENTS} documents for free users. Upgrade for unlimited.`,
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
export async function getUserUsage(userId: string) {
  try {
    const userProfile = await prisma.profiles.findUnique({
      where: { id: userId },
      select: { subscription_plan: true },
    });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
    const isPro = plan === 'pro';

    const [
      notesCount,
      quizzesCount,
      aiGenerationCountThisMonth,
      decksCount,
      flashcardsCount,
      documentsCount,
    ] = await Promise.all([
      prisma.notes.count({ where: { user_id: userId } }),
      prisma.quiz.count({ where: { userId: userId } }),
      getAIGenerationUsageForMonth(userId, new Date()), // --- MODIFIED: Calls local function
      prisma.flashcard_decks.count({ where: { user_id: userId } }),
      prisma.flashcards.count({ where: { deck: { user_id: userId } } }),
      prisma.documents.count({ where: { user_id: userId } }),
    ]);

    const noteLimit = isPro ? USAGE_LIMITS.PRO_NOTES : USAGE_LIMITS.FREE_NOTES;
    const quizLimit = isPro
      ? USAGE_LIMITS.PRO_QUIZZES
      : USAGE_LIMITS.FREE_QUIZZES;
    const aiLimit = isPro
      ? USAGE_LIMITS.PRO_AI_GENERATIONS
      : USAGE_LIMITS.FREE_AI_GENERATIONS;
    const deckLimit = isPro
      ? USAGE_LIMITS.PRO_FLASHCARD_DECKS
      : USAGE_LIMITS.FREE_FLASHCARD_DECKS;
    const cardLimit = isPro
      ? USAGE_LIMITS.PRO_TOTAL_FLASHCARDS
      : USAGE_LIMITS.FREE_TOTAL_FLASHCARDS;
    const docLimit = isPro
      ? USAGE_LIMITS.PRO_DOCUMENTS
      : USAGE_LIMITS.FREE_DOCUMENTS;

    return {
      plan,
      notes: {
        used: notesCount,
        limit: noteLimit,
        remaining: isPro ? Infinity : Math.max(0, noteLimit - notesCount),
      },
      quizzes: {
        used: quizzesCount,
        limit: quizLimit,
        remaining: isPro ? Infinity : Math.max(0, quizLimit - quizzesCount),
      },
      aiGenerations: {
        used: aiGenerationCountThisMonth,
        limit: aiLimit,
        remaining: isPro
          ? Infinity
          : Math.max(0, aiLimit - aiGenerationCountThisMonth),
      },
      flashcardDecks: {
        used: decksCount,
        limit: deckLimit,
        remaining: isPro ? Infinity : Math.max(0, deckLimit - decksCount),
      },
      flashcards: {
        used: flashcardsCount,
        limit: cardLimit,
        remaining: isPro ? Infinity : Math.max(0, cardLimit - flashcardsCount),
      },
      documents: {
        used: documentsCount,
        limit: docLimit,
        remaining: isPro ? Infinity : Math.max(0, docLimit - documentsCount),
      },
    };
  } catch (error) {
    console.error('Error getting user usage:', error);
    return {
      plan: 'free',
      notes: {
        used: 0,
        limit: USAGE_LIMITS.FREE_NOTES,
        remaining: USAGE_LIMITS.FREE_NOTES,
      },
      quizzes: {
        used: 0,
        limit: USAGE_LIMITS.FREE_QUIZZES,
        remaining: USAGE_LIMITS.FREE_QUIZZES,
      },
      aiGenerations: {
        used: 0,
        limit: USAGE_LIMITS.FREE_AI_GENERATIONS,
        remaining: USAGE_LIMITS.FREE_AI_GENERATIONS,
      },
      flashcardDecks: {
        used: 0,
        limit: USAGE_LIMITS.FREE_FLASHCARD_DECKS,
        remaining: USAGE_LIMITS.FREE_FLASHCARD_DECKS,
      },
      flashcards: {
        used: 0,
        limit: USAGE_LIMITS.FREE_TOTAL_FLASHCARDS,
        remaining: USAGE_LIMITS.FREE_TOTAL_FLASHCARDS,
      },
      documents: {
        used: 0,
        limit: USAGE_LIMITS.FREE_DOCUMENTS,
        remaining: USAGE_LIMITS.FREE_DOCUMENTS,
      },
    };
  }
}

/**
 * NEW FUNCTION
 * Increments the AI generation usage count for a user for the current month.
 * This should be called *after* a successful AI generation.
 * Uses Prisma to ensure consistency with checkAIGenerationUsageLimit.
 */
export async function incrementAIGenerationUsage(userId: string, count: number = 1) {
  if (count <= 0) return;

  // Get the first day of the current UTC month
  const now = new Date();
  const firstDayOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  try {
    console.log(`[UsageLib] Incrementing AI usage for ${userId} by ${count} for month ${firstDayOfMonth.toISOString()}`);

    await prisma.ai_usage.upsert({
      where: {
        user_id_usage_month: {
          user_id: userId,
          usage_month: firstDayOfMonth,
        },
      },
      create: {
        user_id: userId,
        usage_month: firstDayOfMonth,
        usage_count: count,
        updated_at: new Date(),
      },
      update: {
        usage_count: {
          increment: count,
        },
        updated_at: new Date(),
      },
    });

    console.log(`[UsageLib] Successfully updated AI usage for ${userId}.`);
  } catch (error) {
    console.error(`[UsageLib] CRITICAL: Failed to increment AI usage for user ${userId}:`, error);
    // We throw this error so the API route can be aware of the failure.
    // In a production system, you might queue this for a retry
    // instead of failing the user's request if the AI part already succeeded.
    throw new Error(`Failed to update AI usage count: ${error instanceof Error ? error.message : 'Unknown DB error'}`);
  }
}