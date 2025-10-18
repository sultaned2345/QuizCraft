-- QuizCraft Simple Database Setup
-- Run this SQL in your Supabase SQL editor

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create users table (integrates with Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    subscription_plan VARCHAR(20) DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    share_link VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_public BOOLEAN DEFAULT FALSE
);

-- Drop existing questions table and policies to redefine it
DROP POLICY IF EXISTS "Users can delete questions of own quizzes" ON questions;
DROP POLICY IF EXISTS "Users can update questions of own quizzes" ON questions;
DROP POLICY IF EXISTS "Users can create questions for own quizzes" ON questions;
DROP POLICY IF EXISTS "Users can view questions of accessible quizzes" ON questions;
DROP TABLE IF EXISTS questions;

-- Create new questions table with additional fields
CREATE TABLE IF NOT EXISTS questions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) NOT NULL,
    correct_answer TEXT NOT NULL,
    options JSONB,
    prompts JSONB,
    explanation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quizzes_user_id ON quizzes(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_id ON questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_share_link ON quizzes(share_link);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

-- Quizzes policies
CREATE POLICY "Users can view own quizzes" ON quizzes
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view public quizzes" ON quizzes
    FOR SELECT USING (is_public = true);

CREATE POLICY "Users can create own quizzes" ON quizzes
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own quizzes" ON quizzes
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own quizzes" ON quizzes
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Questions policies (for the new table structure)
CREATE POLICY "Users can view questions of accessible quizzes" ON questions
    FOR SELECT USING (
        quiz_id IN (
            SELECT id FROM quizzes 
            WHERE user_id::text = auth.uid()::text OR is_public = true
        )
    );

CREATE POLICY "Users can create questions for own quizzes" ON questions
    FOR INSERT WITH CHECK (
        quiz_id IN (
            SELECT id FROM quizzes 
            WHERE user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can update questions of own quizzes" ON questions
    FOR UPDATE USING (
        quiz_id IN (
            SELECT id FROM quizzes 
            WHERE user_id::text = auth.uid()::text
        )
    );

CREATE POLICY "Users can delete questions of own quizzes" ON questions
    FOR DELETE USING (
        quiz_id IN (
            SELECT id FROM quizzes 
            WHERE user_id::text = auth.uid()::text
        )
    );

-- Notes policies
CREATE POLICY "Users can view own notes" ON notes
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can create own notes" ON notes
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own notes" ON notes
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own notes" ON notes
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger to automatically update updated_at on notes
CREATE OR REPLACE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- --- NEW --- AI Notes Usage Tracking ---
  
-- AI Notes Usage Tracking Table
CREATE TABLE IF NOT EXISTS ai_usage (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_count INTEGER NOT NULL DEFAULT 0,
    -- The month this usage record is for. Stored as the first day of the month.
    usage_month DATE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure only one record per user per month
    UNIQUE(user_id, usage_month)
);

-- RLS Policy for the new table
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their own AI usage" ON ai_usage
    FOR ALL USING (auth.uid() = user_id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_month ON ai_usage(user_id, usage_month);

-- Function to increment AI usage count (upsert)
CREATE OR REPLACE FUNCTION increment_ai_usage(p_user_id UUID, p_usage_month DATE, p_increment_by INT)
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