// src/app/(app)/notes/new/page.tsx
// NEW FILE
'use client';
// This page is simple: it just renders the editor with no note.
import { NoteEditor } from '@/components/NoteEditor';

export default function NewNotePage() {
  return <NoteEditor note={null} />;
}