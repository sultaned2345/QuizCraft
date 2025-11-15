// src/app/(app)/documents/page.tsx
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getServerSession } from '@/lib/getServerSession';
// --- 1. CHANGE THIS IMPORT ---
import { DocumentsClientComponent } from './DocumentsClientComponent';
// --- END CHANGE ---

async function getDocuments(userId: string) {
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, created_at, file_path, user_id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching documents:', error);
    return [];
  }
  return data;
}

export default async function DocumentsPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const documents = await getDocuments(session.user.id);

  return <DocumentsClientComponent initialDocuments={documents} />;
}