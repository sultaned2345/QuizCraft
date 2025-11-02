// src/types/database.ts

// --- Base Types ---
export interface User {
  id: string;
  email: string;
  subscription_plan: 'free' | 'pro';
  created_at: string;
}

export type QuestionType = 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_IN_THE_BLANK' | 'MATCHING';

// --- Quiz Types ---
export interface Quiz {
  id: string;
  user_id: string; // Changed from userId to match schema/API
  title: string;
  share_link: string | null;
  created_at: string; // Changed from createdAt to match schema/API
  is_public: boolean;
  immediate_feedback: boolean;
  questions?: Question[]; // Relation
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: QuestionType;
  options: any; // Prisma Json type - consider defining more specific types if possible
  prompts: any; // Prisma Json type - consider defining more specific types if possible
  correct_answer: string;
  explanation: string | null;
  created_at: string; // Changed from createdAt to match schema/API
}

// --- Note Types ---
export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[]; // <-- ADDED
  created_at: string;
  updated_at: string;
}

// src/types/database.ts

export interface Flashcard {
    id: string;
    deck_id: string;
    front_content: string;
    back_content: string;
    created_at: string;
    updated_at: string;
    review_at?: string | null;
    ease_factor?: number | null;
}

// --- Document Types ---
export interface DocumentMetadata {
    id: string;
    user_id: string; // Added user_id if needed client-side
    file_name: string;
    file_type: string;
    file_size: number;
    storage_path: string;
    extracted_text?: string | null; // Optional, might not be needed in all contexts
    created_at: string;
}


// --- Graded Essay Types (NEW) ---
export interface GradedEssayFeedback {
  clarity?: string;
  argument?: string;
  grammar?: string;
  summary?: string;
  // Add other categories as defined in your AI prompt
  [key: string]: string | undefined; // Allow flexible categories
}

export interface GradedEssay {
  id: string;
  user_id: string;
  essay_title: string | null;
  essay_content: string; // May not always be needed on frontend lists
  rubric_or_criteria: string | null;
  feedback: GradedEssayFeedback | PrismaJsonValue | null; // Allow PrismaJsonValue for flexibility from DB
  score: number | null;
  graded_at: string; // Keep as string (ISO format) for consistency
}

// API request body type (for JSON requests)
export interface GradeEssayData {
  essayText: string;
  rubricText?: string; // Optional rubric
  essayTitle?: string; // Optional title
}

// API response data structure (after successful grading)
export interface GradeEssayResponseData {
  id: string; // ID of the saved graded_essay record
  feedback: GradedEssayFeedback;
  score: number | null;
  suggestions?: string[]; // Optional suggestions from AI
  graded_at: string; // ISO string format
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;
  total: number;
  created_at: string;
}

// --- Form Data Types ---
export interface CreateQuizData {
  title: string;
  is_public?: boolean;
}

export interface UpdateQuizData {
  title?: string;
  is_public?: boolean;
}

export interface CreateNoteData {
  title: string;
  content: string;
  tags?: string[]; // <-- ADDED
}

export interface UpdateNoteData {
  title?: string;
  content?: string;
  tags?: string[]; // <-- ADDED
}

export interface CreateDeckData {
    title: string;
}

export interface UpdateDeckData {
    title?: string;
}

export interface CreateFlashcardData {
    deck_id: string;
    front_content: string;
    back_content: string;
}

export interface UpdateFlashcardData {
    front_content?: string;
    back_content?: string;
}

// --- API Response Types ---
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// For Paginated Notes List
export interface NoteListItem {
  id: string;
  user_id: string;
  title: string;
  tags: string[]; // <-- ADDED
  created_at: string;
  updated_at: string;
  // content is excluded
}
export interface PaginatedNotesResponse {
  notes: NoteListItem[];
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}

// For Paginated Decks List
export interface PaginatedDecksResponse {
    decks: FlashcardDeck[]; // Assuming full deck needed for list, adjust if not
    count: number;
    limit: number | typeof Infinity;
    totalPages: number;
    currentPage: number;
}

// For Single Deck View
export interface DeckWithCardsResponse extends FlashcardDeck {
    flashcards: Flashcard[];
    cardCount: number;
    cardLimit: number | typeof Infinity;
}

// For Paginated Documents List
export interface PaginatedDocumentsResponse {
    documents: DocumentMetadata[];
    count: number;
    limit: number | typeof Infinity;
    totalPages: number;
    currentPage: number;
}

// For Listing Graded Essays (Example)
export interface GradedEssaysListResponse {
    essays: Pick<GradedEssay, 'id' | 'essay_title' | 'score' | 'graded_at'>[];
    // Add pagination fields if needed (count, totalPages, currentPage, limit)
}


// --- Utility Types ---
// Type helper for Prisma's JsonValue
import { Prisma } from '@prisma/client';
export type PrismaJsonValue = Prisma.JsonValue;


// --- Original Supabase Types ---
// Can be kept for reference or if using Supabase client directly elsewhere
export interface Database {
  public: {
    Tables: {
      profiles: { Row: User; Insert: Omit<User, 'id' | 'created_at'>; Update: Partial<Omit<User, 'id' | 'created_at'>>; };
      quizzes: { Row: Quiz; Insert: Omit<Quiz, 'id' | 'created_at' | 'questions'>; Update: Partial<Omit<Quiz, 'id' | 'created_at' | 'user_id' | 'questions'>>; };
      questions: { Row: Question; Insert: Omit<Question, 'id' | 'created_at'>; Update: Partial<Omit<Question, 'id' | 'quiz_id' | 'created_at'>>; };
      notes: { Row: Note; Insert: Omit<Note, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Note, 'id' | 'user_id' | 'created_at'>>; };
      flashcard_decks: { Row: FlashcardDeck; Insert: Omit<FlashcardDeck, 'id' | 'created_at' | 'updated_at' | 'flashcards'>; Update: Partial<Omit<FlashcardDeck, 'id' | 'user_id' | 'created_at' | 'flashcards'>>; };
      flashcards: { Row: Flashcard; Insert: Omit<Flashcard, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Flashcard, 'id' | 'deck_id' | 'created_at'>>; };
      documents: { Row: DocumentMetadata; Insert: Omit<DocumentMetadata, 'id' | 'created_at'>; Update: Partial<Omit<DocumentMetadata, 'id' | 'user_id' | 'created_at'>>; };
      // Add graded_essays if needed for direct Supabase client usage
      graded_essays: { Row: GradedEssay; Insert: Omit<GradedEssay, 'id' | 'graded_at'>; Update: Partial<Omit<GradedEssay, 'id' | 'user_id' | 'graded_at'>>; };
    };
    Functions: { // Add Supabase RPC functions if defined and used directly
        increment_ai_usage: { Args: { p_user_id: string, p_usage_month: string, p_increment_by: number }; Returns: void };
        // Add other functions if needed
    };
     Enums: { // Add Supabase Enums if defined and used directly
       // Example: user_plan_enum: 'free' | 'pro'
     };
  };
  // Add other schemas like 'auth' if needed for direct client usage
}