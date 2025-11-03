// src/app/(app)/notes/[noteId]/page.tsx
// NEW FILE
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession';
import { NoteEditor } from '@/components/NoteEditor';
import { redirect } from 'next/navigation';

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
    // Handle not found, maybe redirect to /notes
    redirect('/notes');
  }

  return <NoteEditor note={note} />;
}