import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession';
import { redirect } from 'next/navigation';
import { NoteEditor } from '@/components/NoteEditor';
import { Metadata } from 'next';

// Generate dynamic metadata for the page
export async function generateMetadata({ params }: { params: { noteId: string } }): Promise<Metadata> {
  const note = await prisma.notes.findUnique({
    where: { id: params.noteId },
    select: { title: true }
  });
  return {
    title: `${note?.title || 'Untitled Note'} | QuizCraft`,
  };
}

async function getNoteData(noteId: string, userId: string) {
  try {
    const note = await prisma.notes.findFirst({
      where: {
        id: noteId,
        user_id: userId,
      },
    });

    if (!note) return null;
    
    // Serialize for the client
    return {
      ...note,
      tags: note.tags || [],
      linked_note_ids: note.linked_note_ids || [], 
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

  return (
    <NoteEditor 
      noteId={note.id}
      initialTitle={note.title}
      initialContent={note.content}
      initialTags={note.tags}
      initialLinkedIds={note.linked_note_ids} // ✅ Passed to enable Knowledge Connections
    />
  );
}