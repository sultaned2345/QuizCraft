// src/app/(app)/notes/[noteId]/page.tsx
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession';
// import { NoteEditor } from '@/components/NoteEditor'; // (Static import already removed)
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import NoteEditorLoading from './loading';

const NoteEditor = dynamic(
  () => import('@/components/NoteEditor').then((mod) => mod.NoteEditor),
  {
    loading: () => <NoteEditorLoading />,
    ssr: false, 
  }
);

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
      linked_note_ids: note.linked_note_ids || [], // <-- FIX: Changed from null to []
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

  return <NoteEditor note={note} />;
}