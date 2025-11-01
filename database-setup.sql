-- QuizCraft Complete Database Setup
-- Includes Notes, Flashcards, Documents, and Graded Essays features.
-- This script is safe to run even if tables/policies/functions/triggers already exist.

-- -----------------------------------------------------------------------------
-- Step 1: Create Tables
-- -----------------------------------------------------------------------------

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    subscription_plan VARCHAR(20) DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) DEFAULT 'free';

-- Create quizzes table
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    share_link VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_public BOOLEAN DEFAULT FALSE,
    immediate_feedback BOOLEAN DEFAULT TRUE
);

-- Create questions table
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL,
    correct_answer TEXT NOT NULL,
    options JSONB,
    prompts JSONB,
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notes table
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI usage tracking table
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    usage_count INTEGER NOT NULL DEFAULT 0,
    usage_month DATE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, usage_month)
);

-- Create flashcard_decks table
CREATE TABLE IF NOT EXISTS public.flashcard_decks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create flashcards table
CREATE TABLE IF NOT EXISTS public.flashcards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    deck_id UUID NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
    front_content TEXT NOT NULL,
    back_content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create documents table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    storage_path TEXT NOT NULL UNIQUE,
    extracted_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create graded_essays table
CREATE TABLE IF NOT EXISTS public.graded_essays (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    essay_title TEXT,
    essay_content TEXT NOT NULL,
    rubric_or_criteria TEXT,
    feedback JSONB,
    score INTEGER,
    graded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Creates the table to store quiz attempts
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL, -- Total questions in the quiz at time of attempt
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


-- Adds indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_quiz_id ON public.quiz_attempts(quiz_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
DROP POLICY IF EXISTS "Users can manage their own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "Users can manage their own quiz attempts" ON public.quiz_attempts
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Step 2: Create Indexes for Performance
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON public.quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_month ON public.ai_usage(user_id, usage_month);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_user_id ON public.flashcard_decks(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_deck_id ON public.flashcards(deck_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_graded_essays_user_id ON public.graded_essays(user_id);


-- -----------------------------------------------------------------------------
-- Step 3: Enable Row Level Security (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graded_essays ENABLE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- Step 4: Create RLS Policies
-- -----------------------------------------------------------------------------

-- Profiles Policies
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
CREATE POLICY "Users can manage their own profile" ON public.profiles
    FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Quizzes Policies
DROP POLICY IF EXISTS "Users can manage their own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Public can view public quizzes" ON public.quizzes;
CREATE POLICY "Users can manage their own quizzes" ON public.quizzes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public can view public quizzes" ON public.quizzes
    FOR SELECT USING (is_public = true);

-- Questions Policies
DROP POLICY IF EXISTS "Users can manage questions for their own quizzes" ON public.questions;
DROP POLICY IF EXISTS "Public can view questions for public quizzes" ON public.questions;
CREATE POLICY "Users can manage questions for their own quizzes" ON public.questions
    FOR ALL USING (quiz_id IN (SELECT id FROM public.quizzes WHERE user_id = auth.uid()))
    WITH CHECK (quiz_id IN (SELECT id FROM public.quizzes WHERE user_id = auth.uid()));
CREATE POLICY "Public can view questions for public quizzes" ON public.questions
    FOR SELECT USING (quiz_id IN (SELECT id FROM public.quizzes WHERE is_public = true));

-- Notes Policies
DROP POLICY IF EXISTS "Users can manage own notes" ON public.notes;
CREATE POLICY "Users can manage own notes" ON public.notes
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- AI Usage Policies
DROP POLICY IF EXISTS "Users can manage their own AI usage" ON public.ai_usage;
CREATE POLICY "Users can manage their own AI usage" ON public.ai_usage
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Flashcard Decks Policies
DROP POLICY IF EXISTS "Users can manage their own flashcard decks" ON public.flashcard_decks;
CREATE POLICY "Users can manage their own flashcard decks" ON public.flashcard_decks
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Flashcards Policies
DROP POLICY IF EXISTS "Users can manage flashcards in their own decks" ON public.flashcards;
CREATE POLICY "Users can manage flashcards in their own decks" ON public.flashcards
    FOR ALL USING (deck_id IN (SELECT id FROM public.flashcard_decks WHERE user_id = auth.uid()))
    WITH CHECK (deck_id IN (SELECT id FROM public.flashcard_decks WHERE user_id = auth.uid()));

-- Documents Policies
DROP POLICY IF EXISTS "Users can manage their own documents" ON public.documents;
CREATE POLICY "Users can manage their own documents" ON public.documents
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Graded Essays Policies
DROP POLICY IF EXISTS "Users can manage their own graded essays" ON public.graded_essays;
CREATE POLICY "Users can manage their own graded essays" ON public.graded_essays
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- Step 5: Create Functions & Triggers
-- -----------------------------------------------------------------------------

-- Function to create a profile automatically on auth sign-up
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, subscription_plan)
  VALUES (NEW.id, NEW.email, 'free');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user profile creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Function to automatically update the 'updated_at' timestamp on tables
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- Can remain DEFINER as it just sets a timestamp

-- Trigger for notes updated_at
DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for flashcard_decks updated_at
DROP TRIGGER IF EXISTS update_flashcard_decks_updated_at ON public.flashcard_decks;
CREATE TRIGGER update_flashcard_decks_updated_at
  BEFORE UPDATE ON public.flashcard_decks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for flashcards updated_at
DROP TRIGGER IF EXISTS update_flashcards_updated_at ON public.flashcards;
CREATE TRIGGER update_flashcards_updated_at
  BEFORE UPDATE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to increment AI usage count (Corrected Definition)
CREATE OR REPLACE FUNCTION public.increment_ai_usage(p_user_id UUID, p_usage_month DATE, p_increment_by INT)
RETURNS void AS $$
BEGIN
    INSERT INTO public.ai_usage (user_id, usage_month, usage_count, updated_at)
    VALUES (p_user_id, p_usage_month, p_increment_by, NOW())
    ON CONFLICT (user_id, usage_month)
    DO UPDATE SET
        usage_count = ai_usage.usage_count + p_increment_by,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY INVOKER; -- Use SECURITY INVOKER


-- -----------------------------------------------------------------------------
-- Step 6: Grant Function Permissions
-- -----------------------------------------------------------------------------

-- Grant usage on functions to Supabase authenticated role
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(UUID, DATE, INT) TO authenticated;

-- Grant usage on sequences if not using default UUIDs (not needed for this schema)
-- GRANT USAGE, SELECT ON SEQUENCE public.table_id_seq TO authenticated;