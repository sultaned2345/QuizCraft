import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth'; // Ensure this helper exists/is correct
import { validateRequestBody } from '@/lib/auth'; 
import { ApiResponse, Note, UpdateNoteData } from '@/types/database';
import { Prisma } from '@prisma/client';
import { generateEmbeddingsForContent } from '@/lib/embedding';

export const runtime = 'nodejs';

// --- GET Handler: Fetch a single note by ID ---
export async function GET(
    request: NextRequest,
    { params }: { params: { noteId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { noteId } = params;

        if (!noteId) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Note ID is required.' }, { status: 400 });
        }

        const note = await prisma.notes.findFirst({
            where: { id: noteId, user_id: user.id },
        });

        if (!note) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Note not found or access denied.' }, { status: 404 });
        }

        const responseNote: Note = {
            ...note,
            tags: note.tags || [],
            linked_note_ids: note.linked_note_ids || [],
            created_at: note.created_at ? note.created_at.toISOString() : new Date().toISOString(),
            updated_at: note.updated_at ? note.updated_at.toISOString() : new Date().toISOString(),
        };

        return NextResponse.json<ApiResponse<Note>>({ success: true, data: responseNote });

    } catch (error: any) {
        if (error instanceof Response) return error;
        return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to fetch note' }, { status: 500 });
    }
}

// --- PATCH Handler: Update a Note (MOVED & FIXED) ---
export async function PATCH(
    request: NextRequest,
    { params }: { params: { noteId: string } }
) {
    try {
        const user = await requireAuth(request);
        const { noteId } = params;

        const body: UpdateNoteData = await request.json();
        const { title, content, tags, linked_note_ids } = body;

        // Validation
        if (!title && !content && !tags && !linked_note_ids) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'No fields to update' }, { status: 400 });
        }

        // Verify Ownership
        const existingNote = await prisma.notes.findFirst({
            where: { id: noteId, user_id: user.id },
        });

        if (!existingNote) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Note not found' }, { status: 404 });
        }

        // Prepare Update Object
        const updates: Prisma.notesUpdateInput = {};
        if (title !== undefined) updates.title = title.trim();
        if (content !== undefined) updates.content = content.trim();
        if (tags !== undefined) updates.tags = tags;
        if (linked_note_ids !== undefined) updates.linked_note_ids = linked_note_ids;
        
        updates.updated_at = new Date();

        // Perform Update
        const updatedNoteData = await prisma.notes.update({
            where: { id: noteId },
            data: updates,
        });

        // Re-generate Embeddings if content changed (Async)
        if (content) {
            generateEmbeddingsForContent(updatedNoteData.id, 'note', updatedNoteData.content, user.id)
                .catch(err => console.error(`Embedding error for note ${noteId}:`, err));
        }

        const updatedNote: Note = {
            ...updatedNoteData,
            tags: updatedNoteData.tags || [],
            linked_note_ids: updatedNoteData.linked_note_ids || [],
            created_at: updatedNoteData.created_at?.toISOString() || '',
            updated_at: updatedNoteData.updated_at?.toISOString() || '',
        };

        return NextResponse.json<ApiResponse<Note>>({ 
            success: true, 
            data: updatedNote, 
            message: 'Saved successfully' 
        });

    } catch (error: any) {
        if (error instanceof Response) return error;
        console.error(`[PATCH /api/notes/${params.noteId}] Error:`, error);
        return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to update note' }, { status: 500 });
    }
}

// --- DELETE Handler ---
export async function DELETE(
    request: NextRequest,
    { params }: { params: { noteId: string } }
) {
  try {
    const user = await requireAuth(request);
    const { noteId } = params;

    const transaction = await prisma.$transaction([
        prisma.content_embeddings.deleteMany({
            where: { content_id: noteId, content_type: 'note', user_id: user.id }
        }),
        prisma.notes.deleteMany({
            where: { id: noteId, user_id: user.id }
        })
    ]);

    if (transaction[1].count === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Note not found' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({ success: true, message: 'Note deleted' });

  } catch (error: any) {
    if (error instanceof Response) return error;
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to delete note' }, { status: 500 });
  }
}