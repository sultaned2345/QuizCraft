import { getServerSession } from '@/lib/getServerSession';
import { redirect } from 'next/navigation';
import { NoteEditor } from '@/components/NoteEditor';

export const metadata = {
  title: 'New Note | QuizCraft',
};

export default async function NewNotePage() {
  const session = await getServerSession();

  if (!session?.user) {
    redirect('/login');
  }

  // Render Editor in "Create Mode" (no noteId initially)
  // The editor will handle the POST request to create it on the first save.
  return (
    <NoteEditor 
      initialTitle=""
      initialContent=""
      initialTags={['status:learning']} // Default status
    />
  );
}