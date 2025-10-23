// lib/usage-limits.ts

import { supabaseHelpers } from './supabase';

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
  PRO_NOTES: Infinity,
  PRO_QUIZZES: Infinity,
  PRO_AI_GENERATIONS: Infinity,
};

export async function validateNoteCreation(userId: string): Promise<ValidationResult> {
  try {
    console.log('Validating note creation for user:', userId);
    
    // Get user with plan - handle case where user doesn't exist
    let userPlan;
    try {
      userPlan = await supabaseHelpers.getUserWithPlan(userId);
      console.log('User plan found:', userPlan?.subscription_plan);
    } catch (error: any) {
      console.error('Error fetching user plan:', error);
      
      // If user doesn't exist in database, create a default free plan record
      if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
        console.log('User plan not found, treating as free user');
        // Treat as free user with default limits
        userPlan = { 
          subscription_plan: 'free',
          id: userId 
        };
      } else {
        // Some other database error
        throw error;
      }
    }
    
    // Free users have a limit of 10 notes
    if (userPlan.subscription_plan !== 'pro') {
      const currentCount = await supabaseHelpers.getNotesCount(userId);
      console.log('Current note count:', currentCount, '/ 10');
      
      if (currentCount >= USAGE_LIMITS.FREE_NOTES) {
        return {
          isValid: false,
          error: 'Note limit reached',
          message: `You have reached the maximum number of notes (${USAGE_LIMITS.FREE_NOTES}) for free users. Upgrade to Pro for unlimited notes.`
        };
      }
    }
    
    return {
      isValid: true
    };
    
  } catch (error: any) {
    console.error('Validation error:', error);
    // Don't block note creation on validation errors
    // Log the error but allow the operation to continue
    return {
      isValid: true
    };
  }
}

export async function validateQuizCreation(userId: string): Promise<ValidationResult> {
  try {
    let userPlan;
    try {
      userPlan = await supabaseHelpers.getUserWithPlan(userId);
    } catch (error: any) {
      if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
        userPlan = { subscription_plan: 'free', id: userId };
      } else {
        throw error;
      }
    }
    
    if (userPlan.subscription_plan !== 'pro') {
      const currentCount = await supabaseHelpers.getQuizzesCount(userId);
      
      if (currentCount >= USAGE_LIMITS.FREE_QUIZZES) {
        return {
          isValid: false,
          error: 'Quiz limit reached',
          message: `You have reached the maximum number of quizzes (${USAGE_LIMITS.FREE_QUIZZES}) for free users. Upgrade to Pro for unlimited quizzes.`
        };
      }
    }
    
    return {
      isValid: true
    };
    
  } catch (error: any) {
    console.error('Quiz validation error:', error);
    return {
      isValid: true
    };
  }
}

export async function checkAIGenerationUsageLimit(userId: string): Promise<ValidationResult> {
  try {
    let userPlan;
    try {
      userPlan = await supabaseHelpers.getUserWithPlan(userId);
    } catch (error: any) {
      if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
        userPlan = { subscription_plan: 'free', id: userId };
      } else {
        throw error;
      }
    }
    
    // Pro users have unlimited AI generations
    if (userPlan.subscription_plan === 'pro') {
      return {
        isValid: true
      };
    }
    
    // Free users have a limit on AI generations
    const currentCount = await supabaseHelpers.getAIGenerationCount(userId);
    
    if (currentCount >= USAGE_LIMITS.FREE_AI_GENERATIONS) {
      return {
        isValid: false,
        error: 'AI generation limit reached',
        message: `You have reached the maximum number of AI generations (${USAGE_LIMITS.FREE_AI_GENERATIONS}) for free users. Upgrade to Pro for unlimited AI generations.`
      };
    }
    
    return {
      isValid: true
    };
    
  } catch (error: any) {
    console.error('AI generation validation error:', error);
    // Don't block on validation errors
    return {
      isValid: true
    };
  }
}

// Helper function to get remaining usage for a user
export async function getUserUsage(userId: string) {
  try {
    let userPlan;
    try {
      userPlan = await supabaseHelpers.getUserWithPlan(userId);
    } catch (error: any) {
      if (error.code === 'PGRST116' || error.message?.includes('0 rows')) {
        userPlan = { subscription_plan: 'free', id: userId };
      } else {
        throw error;
      }
    }
    
    const isPro = userPlan.subscription_plan === 'pro';
    
    const [notesCount, quizzesCount, aiGenerationCount] = await Promise.all([
      supabaseHelpers.getNotesCount(userId),
      supabaseHelpers.getQuizzesCount(userId),
      supabaseHelpers.getAIGenerationCount(userId)
    ]);
    
    return {
      plan: userPlan.subscription_plan,
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
      }
    };
  } catch (error) {
    console.error('Error getting user usage:', error);
    // Return default free tier values on error
    return {
      plan: 'free',
      notes: { used: 0, limit: USAGE_LIMITS.FREE_NOTES, remaining: USAGE_LIMITS.FREE_NOTES },
      quizzes: { used: 0, limit: USAGE_LIMITS.FREE_QUIZZES, remaining: USAGE_LIMITS.FREE_QUIZZES },
      aiGenerations: { used: 0, limit: USAGE_LIMITS.FREE_AI_GENERATIONS, remaining: USAGE_LIMITS.FREE_AI_GENERATIONS }
    };
  }
}