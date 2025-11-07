// src/app/(app)/notes/[noteId]/page.tsx
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession';
// import { NoteEditor } from '@/components/NoteEditor'; // <-- 1. REMOVE STATIC IMPORT
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic'; // <-- 2. IMPORT DYNAMIC
import NoteEditorLoading from './loading'; // <-- 3. IMPORT LOADING COMPONENT

// --- 4. LAZY-LOAD THE NOTE EDITOR ---
const NoteEditor = dynamic(
  () => import('@/components/NoteEditor').then((mod) => mod.NoteEditor),
  {
    // Use the specific loading component for the editor
    loading: () => <NoteEditorLoading />,
    // Disable SSR for this heavy client component
    ssr: false, 
  }
);
// --- (getNoteData function is unchanged) ---
async function getNoteData(noteId: string, userId: string) {
  try {
    const note = await prisma.notes.findFirst({
      where: {
        id: noteId,
        user_id: userId,
      },
    });

    if (!note) {
      return null;
    }
    
    // Serialize data for the client
    return {
      ...note,
      tags: note.tags || [],
      linked_note_ids: note.linked_note_ids || null,
      created_at: note.created_at?.toISOString() || '',
      updated_at: note.updated_at?.toISOString() || '',
    };
  } catch (error) {
    console.error("Failed to fetch note:", error);
    return null;
  }
}

export default async function EditNotePage({ params }: { params: { noteId: string } }) {
  const session = await getServerSession();
  if (!session?.user) {
    redirect('/login');
  }

  const note = await getNoteData(params.noteId, session.user.id);

  if (!note) {
    redirect('/notes');
  }

  // --- 5. RENDER THE LAZY-LOADED EDITOR ---
  // Note: We don't need Suspense here because 'loading.tsx'
  // in this route segment will handle the initial server load,
  // and the dynamic import's `loading` prop handles the client-side load.
  return <NoteEditor note={note} />;
}