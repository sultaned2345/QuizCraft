import { prisma } from "@/lib/prisma";

export type StudyQueueItem = 
  | { type: "flashcard_due"; id: string; title: string; dueCount: number; deckId: string }
  | { type: "low_score_quiz"; id: string; title: string; score: number; quizId: string };

export type HeatmapPoint = {
  date: string; // YYYY-MM-DD
  count: number;
};

export type ActivityItem = {
  id: string;
  type: "document" | "quiz" | "note" | "project";
  title: string;
  date: Date;
  url: string;
};

export type TopicPerformance = {
  topic: string;
  score: number; // 0-100
  fullMark: number; // 100
};

/**
 * 1. Smart Study Queue
 * - Fetches Flashcard Decks that have cards due (review_at <= now).
 * - Fetches Quizzes with recent low scores (< 70%).
 */
export async function getSmartStudyQueue(userId: string) {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // A. Flashcards Due
  // We want to find decks, but filter them by cards that are due.
  // Since we can't easily "count" filtered relations in one top-level query without raw SQL or grouping,
  // we'll fetch decks that have at least one due card, then count them in JS or a second lightweight step.
  const decksWithDueCards = await prisma.flashcard_decks.findMany({
    where: {
      user_id: userId,
      flashcards: {
        some: {
          review_at: { lte: now },
        },
      },
    },
    include: {
      flashcards: {
        where: { review_at: { lte: now } },
        select: { id: true }, // Select minimal data to count
      },
    },
    take: 5,
  });

  const flashcardItems: StudyQueueItem[] = decksWithDueCards.map((deck) => ({
    type: "flashcard_due",
    id: deck.id,
    title: deck.title,
    dueCount: deck.flashcards.length,
    deckId: deck.id,
  }));

  // B. Recent Low Quiz Scores (< 70%)
  const recentLowAttempts = await prisma.quiz_attempts.findMany({
    where: {
      user_id: userId,
      created_at: { gte: oneWeekAgo },
    },
    include: {
      quiz: {
        select: { title: true, id: true },
      },
    },
    orderBy: { created_at: "desc" },
    take: 10,
  });

  // Filter for scores < 70%
  const lowScoreItems: StudyQueueItem[] = recentLowAttempts
    .filter((attempt) => {
      const percentage = attempt.total > 0 ? (attempt.score / attempt.total) * 100 : 0;
      return percentage < 70;
    })
    .map((attempt) => ({
      type: "low_score_quiz",
      id: attempt.id, // Attempt ID
      title: attempt.quiz.title,
      score: Math.round((attempt.score / attempt.total) * 100),
      quizId: attempt.quiz.id,
    }))
    .slice(0, 3); // Take top 3 most recent failures

  return {
    dueFlashcards: flashcardItems,
    recentLowScores: lowScoreItems,
  };
}

/**
 * 2. Heatmap Data
 * Aggregates creation/update timestamps from multiple models to visualize daily activity.
 */
export async function getHeatmapData(userId: string): Promise<HeatmapPoint[]> {
  // Fetch timestamps from main activities
  const [attempts, notes, documents, flashcards] = await Promise.all([
    prisma.quiz_attempts.findMany({
      where: { user_id: userId },
      select: { created_at: true },
    }),
    prisma.notes.findMany({
      where: { user_id: userId },
      select: { updated_at: true }, // Use updated_at for notes as editing counts as activity
    }),
    prisma.documents.findMany({
      where: { user_id: userId },
      select: { created_at: true },
    }),
    prisma.flashcards.findMany({
      where: { deck: { user_id: userId } },
      select: { updated_at: true }, // Using updated_at to approximate study/edit time
    }),
  ]);

  const dateMap = new Map<string, number>();

  const processDate = (date: Date | null) => {
    if (!date) return;
    // Format: YYYY-MM-DD
    const key = date.toISOString().split("T")[0];
    dateMap.set(key, (dateMap.get(key) || 0) + 1);
  };

  attempts.forEach((a) => processDate(a.created_at));
  notes.forEach((n) => processDate(n.updated_at));
  documents.forEach((d) => processDate(d.created_at));
  flashcards.forEach((f) => processDate(f.updated_at));

  // Convert Map to Array
  return Array.from(dateMap.entries()).map(([date, count]) => ({
    date,
    count,
  }));
}

/**
 * 3. Recent Activity (Jump Back In)
 * Merges Documents, Quizzes, Notes, and Projects into a single timeline sorted by date.
 */
export async function getRecentActivity(userId: string): Promise<ActivityItem[]> {
  const [docs, notes, projects, quizzes] = await Promise.all([
    prisma.documents.findMany({
      where: { user_id: userId },
      orderBy: { created_at: "desc" },
      take: 5,
      select: { id: true, file_name: true, created_at: true },
    }),
    prisma.notes.findMany({
      where: { user_id: userId },
      orderBy: { updated_at: "desc" },
      take: 5,
      select: { id: true, title: true, updated_at: true },
    }),
    prisma.projects.findMany({
      where: { user_id: userId },
      orderBy: { updated_at: "desc" },
      take: 5,
      select: { id: true, title: true, updated_at: true },
    }),
    prisma.quiz.findMany({
      where: { userId: userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, createdAt: true },
    }),
  ]);

  const combined: ActivityItem[] = [
    ...docs.map((d) => ({
      id: d.id,
      type: "document" as const,
      title: d.file_name,
      date: d.created_at || new Date(),
      url: `/documents/${d.id}`,
    })),
    ...notes.map((n) => ({
      id: n.id,
      type: "note" as const,
      title: n.title,
      date: n.updated_at || new Date(),
      url: `/notes/${n.id}`,
    })),
    ...projects.map((p) => ({
      id: p.id,
      type: "project" as const,
      title: p.title,
      date: p.updated_at || new Date(),
      url: `/projects/${p.id}`,
    })),
    ...quizzes.map((q) => ({
      id: q.id,
      type: "quiz" as const,
      title: q.title,
      date: q.createdAt || new Date(),
      url: `/quiz/${q.id}`,
    })),
  ];

  // Sort descending by date and take top 6
  return combined.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 6);
}

/**
 * 4. Knowledge Radar
 * Aggregates quiz performance grouped by Quiz Title (serving as "Topic" for now).
 * Returns average score % per topic.
 */
export async function getQuizPerformance(userId: string): Promise<TopicPerformance[]> {
  const attempts = await prisma.quiz_attempts.findMany({
    where: { user_id: userId },
    include: {
      quiz: {
        select: { title: true },
      },
    },
    orderBy: { created_at: "desc" },
    take: 50, // Analyze last 50 attempts for performance trends
  });

  const topicStats = new Map<string, { totalScore: number; count: number }>();

  attempts.forEach((attempt) => {
    const topic = attempt.quiz.title;
    const percentage = attempt.total > 0 ? (attempt.score / attempt.total) * 100 : 0;

    const current = topicStats.get(topic) || { totalScore: 0, count: 0 };
    topicStats.set(topic, {
      totalScore: current.totalScore + percentage,
      count: current.count + 1,
    });
  });

  const results: TopicPerformance[] = [];
  topicStats.forEach((value, key) => {
    results.push({
      topic: key,
      score: Math.round(value.totalScore / value.count),
      fullMark: 100,
    });
  });

  // Return top 6 topics to keep the chart clean
  return results.slice(0, 6);
}