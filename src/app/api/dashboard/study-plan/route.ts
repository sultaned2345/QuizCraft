// src/app/api/dashboard/study-plan/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse } from '@/types/database';
import { generateQueryEmbedding } from '@/lib/embedding';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface StudySuggestion {
  type: 'flashcard' | 'quiz' | 'note' | 'document';
  id: string;
  title: string;
  reason: string;
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const suggestions: StudySuggestion[] = [];
    const now = new Date();

    // --- 1. Get due flashcard decks (Limit 2) ---
    const dueDecks = await prisma.flashcard_decks.findMany({
      where: {
        user_id: user.id,
        flashcards: {
          some: {
            review_at: { lte: now },
          },
        },
      },
      select: {
        id: true,
        title: true,
      },
      take: 2,
    });

    dueDecks.forEach(deck => {
      suggestions.push({
        type: 'flashcard',
        id: deck.id,
        title: deck.title,
        reason: 'Cards are due for review.',
      });
    });
    const suggestedDeckIds = dueDecks.map(d => d.id);
    const suggestedQuizIds = new Set<string>();

    // --- 2. Get recent attempts to find candidates for RAG ---
    const recentAttempts = await prisma.quiz_attempts.findMany({
      where: {
        user_id: user.id,
      },
      include: {
        quiz: {
          select: { id: true, title: true, questions: { select: { question_text: true } } },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
    });
    
    // --- 3. NEW: Attempt to add one RAG-based suggestion ---
    let ragSuggestionAdded = false;
    for (const attempt of recentAttempts) {
      if (!attempt.quiz || ragSuggestionAdded) continue;

      const scorePercent = (attempt.score / attempt.total) * 100;
      
      // If score is low, try to find related content
      if (scorePercent < 70) {
        try {
          const quizWithQuestions = attempt.quiz;
          if (quizWithQuestions && quizWithQuestions.questions.length > 0) {
            
            // Combine quiz title and questions for a good embedding
            const contentToEmbed = quizWithQuestions.title + " " + quizWithQuestions.questions.map(q => q.question_text).join(" ");
            const embedding = await generateQueryEmbedding(contentToEmbed);

            // Call our RPC function
            // FIX: Added "as any" to args to bypass strict type checking if definition is missing
            const { data: relatedItems, error: rpcError } = await supabaseAdmin.rpc('match_related_content', {
                query_embedding: embedding,
                match_threshold: 0.7,
                match_count: 1,
                p_user_id: user.id,
                exclude_content_id: quizWithQuestions.id
            } as any);

            if (rpcError) throw rpcError;

            const topMatch = relatedItems?.[0];
            
            // If we found a good match, add it as a suggestion
            if (topMatch) {
                suggestions.push({
                    type: topMatch.content_type, // 'note' or 'document'
                    id: topMatch.content_id,
                    title: topMatch.content_title,
                    reason: `This may help with '${quizWithQuestions.title}', where you scored ${scorePercent.toFixed(0)}%.`
                });
                ragSuggestionAdded = true;
                suggestedQuizIds.add(quizWithQuestions.id);
            }
          }
        } catch (ragError) {
            console.error(`Failed to generate RAG suggestion for quiz ${attempt.quiz.id}:`, ragError);
        }
      }
    }
    
    // --- 4. Get other low-scoring quizzes (Limit 2) ---
    const quizzesToReview: StudySuggestion[] = [];
    for (const attempt of recentAttempts) {
        if (!attempt.quiz) continue;
        const scorePercent = (attempt.score / attempt.total) * 100;
        
        if (scorePercent < 70 && !suggestedQuizIds.has(attempt.quiz.id) && quizzesToReview.length < 2) {
            quizzesToReview.push({
                type: 'quiz',
                id: attempt.quiz.id,
                title: attempt.quiz.title,
                reason: `You scored ${scorePercent.toFixed(0)}% on a recent attempt.`,
            });
            suggestedQuizIds.add(attempt.quiz.id); // Mark as handled
        }
    }
    suggestions.push(...quizzesToReview);

    // --- 5. Get decks with "New" cards (Limit 1) ---
    const newCardDecks = await prisma.flashcard_decks.findMany({
        where: {
            user_id: user.id,
            id: { notIn: suggestedDeckIds },
            flashcards: { some: { review_at: { lte: now }, ease_factor: 2.5 } }
        },
        select: { id: true, title: true },
        take: 1,
    });
    newCardDecks.forEach(deck => {
      suggestions.push({
        type: 'flashcard',
        id: deck.id,
        title: deck.title,
        reason: 'This deck has new cards to learn.',
      });
    });

    // --- 6. Get unattempted quizzes (Limit 2) ---
    const allAttemptedIds = new Set(recentAttempts.map(a => a.quiz_id).concat(Array.from(suggestedQuizIds)));
    const unattemptedQuizzes = await prisma.quiz.findMany({
        where: {
            userId: user.id,
            id: { notIn: Array.from(allAttemptedIds) },
            questions: { some: {} }
        },
        select: { id: true, title: true },
        orderBy: { createdAt: 'desc' },
        take: 2,
    });
    unattemptedQuizzes.forEach(quiz => {
        suggestions.push({
            type: 'quiz',
            id: quiz.id,
            title: quiz.title,
            reason: "You haven't tried this quiz yet."
        });
    });

    // --- 7. Shuffle and take top 5 suggestions ---
    const finalSuggestions = suggestions
      .sort(() => 0.5 - Math.random())
      .slice(0, 5);

    return NextResponse.json<ApiResponse<StudySuggestion[]>>({
      success: true,
      data: finalSuggestions,
    });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error('[API /dashboard/study-plan] Error:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to generate study plan.' },
      { status: 500 }
    );
  }
}