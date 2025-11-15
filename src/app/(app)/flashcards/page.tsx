// src/app/(app)/flashcards/page.tsx
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getServerSession } from '@/lib/getServerSession';
// --- 1. CHANGE THIS IMPORT ---
import { FlashcardsClientComponent } from './FlashcardsClientComponent';
// --- END CHANGE ---

async function getDecks(userId: string) {
  const { data, error } = await supabase
    .from('flashcard_decks')
    .select('*, flashcards(id)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching decks:', error);
    return [];
  }

  // Map data to include card count
  const decksWithCount = data.map(deck => ({
    ...deck,
    card_count: Array.isArray(deck.flashcards) ? deck.flashcards.length : 0,
  }));
  
  return decksWithCount;
}

export default async function FlashcardsPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const decks = await getDecks(session.user.id);

  return <FlashcardsClientComponent initialDecks={decks} />;
}