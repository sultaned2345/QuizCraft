// src/app/(app)/notes/new/page.tsx
'use client';
// This page is simple: it just renders the editor with no note.
// import { NoteEditor } from '@/components/NoteEditor'; // <-- 1. REMOVE STATIC IMPORT
import dynamic from 'next/dynamic'; // <-- 2. IMPORT DYNAMIC
import NoteEditorLoading from '../[noteId]/loading'; // <-- 3. IMPORT LOADING COMPONENT

// --- 4. LAZY-LOAD THE NOTE EDITOR ---
const NoteEditor = dynamic(
  () => import('@/components/NoteEditor').then((mod) => mod.NoteEditor),
  {
    loading: () => <NoteEditorLoading />,
    ssr: false, // No need to SSR a new, empty editor
  }
);

export default function NewNotePage() {
  return <NoteEditor note={null} />;
}