import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, Note } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// --- GET Handler: Fetch a single note by ID (Unchanged) ---
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

        // Fetch the full note, ensuring user ownership
        const note = await prisma.notes.findFirst({ // Use findFirst to honor RLS
            where: {
                id: noteId,
                user_id: user.id, // Verify ownership
            },
        });

        if (!note) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Note not found or access denied.' }, { status: 404 });
        }

        // Serialize dates safely handling nulls
        const responseNote: Note = {
            ...note,
            tags: note.tags || [],
            linked_note_ids: note.linked_note_ids || [],
            // FIX: Handle nullable dates from Prisma
            created_at: note.created_at ? note.created_at.toISOString() : new Date().toISOString(),
            updated_at: note.updated_at ? note.updated_at.toISOString() : new Date().toISOString(),
        };

        return NextResponse.json<ApiResponse<Note>>({
            success: true,
            data: responseNote,
        });

    } catch (error: any) {
        if (error instanceof Response) return error; // Handle requireAuth errors
        console.error(`Error fetching note ${params.noteId}:`, error);
        
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') {
             return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Note ID format.' }, { status: 400 });
        }
        
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch note content';
        return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
    }
}

// --- NEW: DELETE Handler (Moved from /api/notes/route.ts and Refactored) ---
export async function DELETE(
    request: NextRequest,
    { params }: { params: { noteId: string } }
) {
  try {
    const user = await requireAuth(request);
    const { noteId } = params;

    if (!noteId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Note ID is required' }, { status: 400 });
    }

    // Use a transaction to delete the note and its embeddings in one go
    const transaction = await prisma.$transaction([
        // 1. Delete associated embeddings
        prisma.content_embeddings.deleteMany({
            where: {
                content_id: noteId,
                content_type: 'note',
                user_id: user.id // Ensures user can only delete their own embeddings
            }
        }),
        // 2. Delete the note itself, checking for ownership
        prisma.notes.deleteMany({
            where: {
                id: noteId,
                user_id: user.id // Ensures user can only delete their own note
            }
        })
    ]);

    const deleteResult = transaction[1]; // Get the result of the notes.deleteMany

    // If no note was deleted (count is 0), it was not found or not owned
    if (deleteResult.count === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Note not found or access denied' }, { status: 404 });
    }

    return NextResponse.json<ApiResponse>({ success: true, message: 'Note and associated embeddings deleted successfully' });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error(`[DELETE /api/notes/${params.noteId}] Error:`, error);
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
         if (error.code === 'P2023') { // Invalid UUID format
             return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid Note ID format.' }, { status: 400 });
         }
         console.error('Prisma Error deleting note:', { code: error.code, meta: error.meta });
         return NextResponse.json<ApiResponse>({ success: false, error: 'Database error deleting note.' }, { status: 500 });
     }
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete note';
    return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
  }
}