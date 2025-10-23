-- QuizCraft Complete Database Setup (Option B: subscription_plan on profiles)
-- This script is safe to run even if tables/policies/functions/triggers already exist.

-- -----------------------------------------------------------------------------
-- Step 1: Create Tables
-- -----------------------------------------------------------------------------

-- Create profiles table to store public user data, linked to auth.users
-- Renamed from 'users' to 'profiles' to match code expectations and Option B
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    subscription_plan VARCHAR(20) DEFAULT 'free', -- Added column here
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quizzes table, referencing public.profiles
CREATE TABLE IF NOT EXISTS public.quizzes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Changed reference
    title VARCHAR(255) NOT NULL,
    share_link VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_public BOOLEAN DEFAULT FALSE,
    immediate_feedback BOOLEAN DEFAULT TRUE -- Added based on schema
);

-- Create questions table with detailed fields, referencing public.quizzes
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL, -- e.g., 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'MATCHING'
    correct_answer TEXT NOT NULL,
    options JSONB, -- For multiple choice answers or matching options
    prompts JSONB,   -- For matching prompts
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notes table for user-generated content, referencing public.profiles
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Changed reference
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create AI usage tracking table, referencing public.profiles
CREATE TABLE IF NOT EXISTS public.ai_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE, -- Changed reference
    usage_count INTEGER NOT NULL DEFAULT 0,
    -- The month this usage record is for. Stored as the first day of the month.
    usage_month DATE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure only one record per user per month
    UNIQUE(user_id, usage_month)
);

-- -----------------------------------------------------------------------------
-- Step 2: Create Indexes for Performance
-- -----------------------------------------------------------------------------
-- Ensure indexes are on the correct tables
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email); -- Added index on email
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON public.quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON public.questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON public.notes(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_month ON public.ai_usage(user_id, usage_month);

-- -----------------------------------------------------------------------------
-- Step 3: Enable Row Level Security (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Step 4: Create RLS Policies
-- -----------------------------------------------------------------------------

-- Policies for 'profiles' table (previously 'users')
DROP POLICY IF EXISTS "Users can manage their own profile" ON public.profiles;
CREATE POLICY "Users can manage their own profile" ON public.profiles
    FOR ALL USING (auth.uid() = id); -- Allows users to select/update/delete their own profile

-- Policies for 'quizzes' table
DROP POLICY IF EXISTS "Users can manage their own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Public can view public quizzes" ON public.quizzes;
CREATE POLICY "Users can manage their own quizzes" ON public.quizzes
    FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public can view public quizzes" ON public.quizzes
    FOR SELECT USING (is_public = true);

-- Policies for 'questions' table
DROP POLICY IF EXISTS "Users can manage questions for their own quizzes" ON public.questions;
DROP POLICY IF EXISTS "Public can view questions for public quizzes" ON public.questions;
CREATE POLICY "Users can manage questions for their own quizzes" ON public.questions
    FOR ALL USING (quiz_id IN (SELECT id FROM public.quizzes WHERE user_id = auth.uid()));
CREATE POLICY "Public can view questions for public quizzes" ON public.questions
    FOR SELECT USING (quiz_id IN (SELECT id FROM public.quizzes WHERE is_public = true));

-- Policies for 'notes' table
DROP POLICY IF EXISTS "Users can view own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can create own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can update own notes" ON public.notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON public.notes;

CREATE POLICY "Users can view own notes" ON public.notes
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own notes" ON public.notes
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.notes
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.notes
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for 'ai_usage' table
DROP POLICY IF EXISTS "Users can manage their own AI usage" ON public.ai_usage;
CREATE POLICY "Users can manage their own AI usage" ON public.ai_usage
    FOR ALL USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Step 5: Create Functions & Triggers
-- -----------------------------------------------------------------------------

-- Function to create a profile automatically on auth sign-up
-- Renamed from handle_new_user to handle_new_auth_user for clarity
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into the public.profiles table, including the default subscription plan
  INSERT INTO public.profiles (id, email, subscription_plan)
  VALUES (NEW.id, NEW.email, 'free'); -- Default plan is 'free'
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute the function after a new user signs up in auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- Function to automatically update the 'updated_at' timestamp on notes
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update 'notes.updated_at' before any update operation
DROP TRIGGER IF EXISTS update_notes_updated_at ON public.notes;
CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to increment AI usage count (upsert logic)
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
$$ LANGUAGE plpgsql;

-- Grant usage on functions to Supabase authenticated role
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(UUID, DATE, INT) TO authenticated;