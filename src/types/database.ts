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
  user_id: string;
  title: string;
  share_link: string | null;
  created_at: string;
  is_public: boolean;
  immediate_feedback: boolean;
  questions?: Question[]; // Relation
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: QuestionType;
  options: any; // Prisma Json type
  prompts: any; // Prisma Json type
  correct_answer: string;
  explanation: string | null;
  createdAt: string; // Based on Prisma schema
}

// --- Note Types ---
export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

// --- Flashcard Types (NEW) ---
export interface FlashcardDeck {
    id: string;
    user_id: string;
    title: string;
    created_at: string;
    updated_at: string;
    flashcards?: Flashcard[]; // Optional relation field
}

export interface Flashcard {
    id: string;
    deck_id: string;
    front_content: string;
    back_content: string;
    created_at: string;
    updated_at: string;
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
}

export interface UpdateNoteData {
  title?: string;
  content?: string;
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

export interface NotesResponse {
  notes: Note[];
  count: number;
  limit: number | typeof Infinity;
}

export interface DecksResponse {
    decks: FlashcardDeck[];
    count: number;
    limit: number | typeof Infinity;
}

export interface DeckWithCardsResponse extends FlashcardDeck {
    flashcards: Flashcard[];
    cardCount: number;
    cardLimit: number | typeof Infinity;
}

// --- Original Supabase Types (Can be kept or removed if not using Supabase client directly) ---
export interface Database {
  public: {
    Tables: {
      profiles: { // Changed from 'users'
        Row: User;
        Insert: Omit<User, 'id' | 'created_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at'>>;
      };
      quizzes: {
        Row: Quiz;
        Insert: Omit<Quiz, 'id' | 'created_at' | 'questions'>;
        Update: Partial<Omit<Quiz, 'id' | 'created_at' | 'user_id' | 'questions'>>;
      };
      questions: {
        Row: Question;
        Insert: Omit<Question, 'id' | 'createdAt'>;
        Update: Partial<Omit<Question, 'id' | 'quiz_id' | 'createdAt'>>;
      };
      notes: {
        Row: Note;
        Insert: Omit<Note, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Note, 'id' | 'user_id' | 'created_at'>>;
      };
      // You would add flashcard tables here if using Supabase client types
    };
  };
}