// src/types/database.ts

// --- Base Types ---
export interface User {
  id: string;
  email: string;
  subscription_plan: 'free' | 'pro';
  created_at: string;
}

export type QuestionType =
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'FILL_IN_THE_BLANK'
  | 'MATCHING'
  | 'ORDERING';

// --- Quiz Types ---
export interface Quiz {
  id: string;
  user_id: string;
  title: string;
  share_link: string | null;
  created_at: string;
  is_public: boolean;
  immediate_feedback: boolean;
  time_limit_minutes: number | null;
  questions?: Question[]; // Relation
}

export interface Question {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: QuestionType;
  options: any; // Prisma Json type (string[] usually)
  prompts: any; // Prisma Json type (string[] for Matching)
  correct_answer: string;
  explanation: string | null;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;
  total: number;
  created_at: string;
}

// --- Note Types ---
export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  tags: string[];
  linked_note_ids: string[];
  created_at: string;
  updated_at: string;
}

// --- Flashcard Types ---
export interface FlashcardDeck {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  flashcards?: Flashcard[]; // Relation
  _count?: {
    flashcards: number;
  };
}

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
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  storage_path: string;
  extracted_text?: string | null;
  ai_summary?: string | null;
  ai_insights?: any | null;
  created_at: string;
}

// --- Graded Essay Types ---
export interface EssayFeedbackHighlight {
  text: string;
  comment: string;
}

export interface EssayFeedbackCategory {
  summary: string;
  highlights: EssayFeedbackHighlight[];
}

export interface GradedEssayFeedback {
  strengths?: EssayFeedbackCategory | string;
  clarity?: EssayFeedbackCategory | string;
  argument?: EssayFeedbackCategory | string;
  grammar?: EssayFeedbackCategory | string;
  summary: string;
  [key: string]: EssayFeedbackCategory | string | undefined;
}

export type GenericJsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: GenericJsonValue }
  | GenericJsonValue[];

export interface GradedEssay {
  id: string;
  user_id: string;
  essay_title: string | null;
  essay_content: string;
  rubric_or_criteria: string | null;
  feedback: GradedEssayFeedback | GenericJsonValue | null;
  score: number | null;
  graded_at: string;
}

export interface GradeEssayData {
  essayText: string;
  rubricText?: string;
  essayTitle?: string;
}

export interface GradeEssayResponseData {
  id: string;
  feedback: GradedEssayFeedback;
  score: number | null;
  suggestions?: string[];
  graded_at: string;
  essay_content: string;
}

// --- Project Types ---
export interface Project {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  links?: ProjectContentLink[]; // Optional relation
  _count?: {
    links: number;
  };
}

export interface ProjectContentLink {
  id: string;
  user_id: string;
  project_id: string;
  content_id: string;
  content_type: 'document' | 'quiz' | 'note' | 'deck';
  created_at: string;
}

export interface ProjectContentDetails {
  links: {
    id: string; // link ID
    content_id: string;
    content_type: string;
    created_at: string;
    // Joined data:
    title: string;
    description: string | null;
    icon: string; // 'document', 'quiz', 'note', 'deck'
  }[];
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
  tags?: string[];
  linked_note_ids?: string[];
}
export interface UpdateNoteData {
  title?: string;
  content?: string;
  tags?: string[];
  linked_note_ids?: string[];
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
  tags: string[];
  created_at: string;
  updated_at: string;
}
export interface PaginatedNotesResponse {
  notes: NoteListItem[];
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}

export interface GeneratedDeckInfo {
  id: string;
  title: string;
}

export interface RelatedItem {
  content_id: string;
  content_type: 'note' | 'document';
  content_title: string;
  content_chunk: string;
  similarity: number;
  citation?: number;
}

// For Paginated Decks List
export interface PaginatedDecksResponse {
  decks: FlashcardDeck[];
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

// For Listing Graded Essays
export interface GradedEssaysListResponse {
  essays: Pick<GradedEssay, 'id' | 'essay_title' | 'score' | 'graded_at'>[];
}

// --- Database Schema Interface (Supabase/Postgres) ---
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at'>;
        Update: Partial<Omit<User, 'id' | 'created_at'>>;
      };
      quizzes: {
        Row: Quiz;
        Insert: Omit<Quiz, 'id' | 'created_at' | 'questions'>;
        Update: Partial<
          Omit<Quiz, 'id' | 'created_at' | 'user_id' | 'questions'>
        >;
      };
      questions: {
        Row: Question;
        Insert: Omit<Question, 'id' | 'created_at'>;
        Update: Partial<Omit<Question, 'id' | 'quiz_id' | 'created_at'>>;
      };
      notes: {
        Row: Note;
        Insert: Omit<Note, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Note, 'id' | 'user_id' | 'created_at'>>;
      };
      flashcard_decks: {
        Row: FlashcardDeck;
        Insert: Omit<
          FlashcardDeck,
          'id' | 'created_at' | 'updated_at' | 'flashcards'
        >;
        Update: Partial<
          Omit<FlashcardDeck, 'id' | 'user_id' | 'created_at' | 'flashcards'>
        >;
      };
      flashcards: {
        Row: Flashcard;
        Insert: Omit<Flashcard, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Flashcard, 'id' | 'deck_id' | 'created_at'>>;
      };
      documents: {
        Row: DocumentMetadata;
        Insert: Omit<DocumentMetadata, 'id' | 'created_at'>;
        Update: Partial<
          Omit<DocumentMetadata, 'id' | 'user_id' | 'created_at'>
        >;
      };
      graded_essays: {
        Row: GradedEssay;
        Insert: Omit<GradedEssay, 'id' | 'graded_at'>;
        Update: Partial<Omit<GradedEssay, 'id' | 'user_id' | 'graded_at'>>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'links'>;
        Update: Partial<Omit<Project, 'id' | 'user_id' | 'created_at'>>;
      };
      project_content_links: {
        Row: ProjectContentLink;
        Insert: Omit<ProjectContentLink, 'id' | 'created_at'>;
        Update: Partial<Omit<ProjectContentLink, 'id' | 'user_id' | 'project_id' | 'created_at'>>;
      };
    };
    Functions: {
      increment_ai_usage: {
        Args: {
          p_user_id: string;
          p_usage_month: string;
          p_increment_by: number;
        };
        Returns: void;
      };
      match_content_chunks: {
        Args: {
          query_embedding: number[];
          match_threshold: number;
          match_count: number;
          p_user_id: string;
          p_content_id: string | null;
        };
        Returns: {
          content_id: string;
          content_type: 'note' | 'document' | 'project';
          content_title: string;
          content_chunk: string;
          similarity: number;
        }[];
      };
      // FIX: Added missing RPC definition matching the call in route.ts
      match_related_content: {
        Args: {
          query_embedding: number[];
          match_threshold: number;
          match_count: number;
          p_user_id: string;
          exclude_content_id: string | null;
        };
        Returns: {
          content_id: string;
          content_type: 'note' | 'document';
          content_title: string;
          content_chunk: string;
          similarity: number;
        }[];
      };
    };
    Enums: {};
  };
}