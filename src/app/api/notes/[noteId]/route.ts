// src/app/api/notes/[noteId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, Note } from '@/types/database';
import { Prisma } from '@prisma/client';

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

        // Fetch the full note, ensuring user ownership
        const note = await prisma.notes.findUnique({
            where: {
                id: noteId,
                user_id: user.id, // Verify ownership
            },
        });

        if (!note) {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Note not found or access denied.' }, { status: 404 });
        }

        // Serialize dates (Prisma dates are objects)
        const responseNote: Note = {
            ...note,
            tags: note.tags || [], // <-- ADDED
            created_at: note.created_at.toISOString(),
            updated_at: note.updated_at.toISOString(),
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