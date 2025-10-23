// lib/usage-limits.ts

import { supabaseHelpers } from './supabase';

interface ValidationResult {
  isValid: boolean;
  error?: string;
  message?: string;
}

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
      
      if (currentCount >= 10) {
        return {
          isValid: false,
          error: 'Note limit reached',
          message: 'You have reached the maximum number of notes (10) for free users. Upgrade to Pro for unlimited notes.'
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
      
      if (currentCount >= 5) {
        return {
          isValid: false,
          error: 'Quiz limit reached',
          message: 'You have reached the maximum number of quizzes (5) for free users. Upgrade to Pro for unlimited quizzes.'
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