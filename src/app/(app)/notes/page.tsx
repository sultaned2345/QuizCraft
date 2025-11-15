// src/app/(app)/notes/page.tsx
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getServerSession } from '@/lib/getServerSession';
// --- 1. CHANGE THIS IMPORT ---
import { NotesClientComponent } from './NotesClientComponent';
// --- END CHANGE ---
import type { Database } from '@/types/database';

type Note = Database['public']['Tables']['notes']['Row'];

async function getNotes(userId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching notes:', error);
    return [];
  }
  return data;
}

export default async function NotesPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const notes = await getNotes(session.user.id);

  return <NotesClientComponent initialNotes={notes} />;
}