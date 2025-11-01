// src/app/api/notes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, validateRequestBody } from '@/lib/auth';
import { USAGE_LIMITS } from '@/lib/usage-limits';
import { ApiResponse, CreateNoteData, UpdateNoteData, Note, NoteListItem, PaginatedNotesResponse } from '@/types/database';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { generateEmbeddingsForContent } from '@/lib/embedding'; // <-- NEW IMPORT

// ... (validateNoteCreation and GET function remain the same) ...
// (GET function from file:)
// (validateNoteCreation function from file:)

// --- POST function (Uses Prisma) ---
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    let limitValidation = await validateNoteCreation(user.id); //
    if (!limitValidation.isValid) {
      return NextResponse.json<ApiResponse>({ success: false, error: limitValidation.error, message: limitValidation.message }, { status: 403 }); //
    }

    let body: CreateNoteData;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON in request body' }, { status: 400 }); //
    }
    
    const validation = validateRequestBody(body, ['title', 'content']); //
    if (!validation.isValid) {
      return NextResponse.json<ApiResponse>({ success: false, error: validation.error }, { status: 400 }); //
    }
    
    const newNote = await prisma.notes.create({
        data: {
            user_id: user.id,
            title: body.title.trim(),
            content: body.content.trim(),
            tags: body.tags || [],
        }
    }); //

    // --- NEW: Asynchronously generate embeddings ---
    // We don't await this; let it run in the background.
    // No need to block the user's response.
    generateEmbeddingsForContent(newNote.id, 'note', newNote.content, user.id)
      .catch(err => {
        console.error(`Failed to generate embeddings for note ${newNote.id}:`, err);
      });
    // --- END NEW ---

    const responseNote = {
        ...newNote,
        tags: newNote.tags || [],
        created_at: newNote.created_at?.toISOString() || '',
        updated_at: newNote.updated_at?.toISOString() || '',
    }; //

    return NextResponse.json<ApiResponse<Note>>({ success: true, data: responseNote, message: 'Note created successfully' }, { status: 201 }); //

  } catch (error: any) {
    // ... (error handling remains the same) ...
    console.error('Unexpected error in POST /api/notes:', error);
     if (error instanceof Response) return error; 
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
        console.error('Prisma Error creating note:', { code: error.code, meta: error.meta });
        return NextResponse.json<ApiResponse>({ success: false, error: 'Database error occurred while creating the note.' }, { status: 500 });
    }
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error: ' + (error.message || 'Unknown error') }, { status: 500 });
  }
}


// --- PUT function (Uses Prisma) ---
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request); //
    const url = new URL(request.url);
    const noteId = url.searchParams.get('id'); //

    if (!noteId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Note ID is required' }, { status: 400 }); //
    }

    const body: UpdateNoteData = await request.json(); //
    const { title, content, tags } = body;

    if (title === undefined && content === undefined && tags === undefined) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Title, content, or tags is required for update' }, { status: 400 }); //
    }

    // ... (ownership verification remains the same) ...
    const existingNote = await prisma.notes.findUnique({
        where: { id: noteId },
        select: { user_id: true }
    });

    if (!existingNote) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Note not found' }, { status: 404 });
    }
    if (existingNote.user_id !== user.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const updates: Prisma.notesUpdateInput = {};
    if (title !== undefined) {
      if (title.trim().length === 0) return NextResponse.json<ApiResponse>({ success: false, error: 'Title cannot be empty' }, { status: 400 }); //
      updates.title = title.trim(); //
    }
    if (content !== undefined) {
       updates.content = content.trim(); //
     }
    if (tags !== undefined && Array.isArray(tags)) {
        updates.tags = tags; //
    }

    if (Object.keys(updates).length === 0) return NextResponse.json<ApiResponse>({ success: false, error: 'No valid fields provided for update' }, { status: 400 }); //

    const updatedNoteData = await prisma.notes.update({
        where: { id: noteId },
        data: updates
    }); //

     // --- NEW: Asynchronously RE-generate embeddings if content changed ---
    if (content !== undefined) {
      generateEmbeddingsForContent(updatedNoteData.id, 'note', updatedNoteData.content, user.id)
        .catch(err => {
          console.error(`Failed to RE-generate embeddings for note ${updatedNoteData.id}:`, err);
        });
    }
    // --- END NEW ---

    const updatedNote = {
        ...updatedNoteData,
        tags: updatedNoteData.tags || [],
        created_at: updatedNoteData.created_at?.toISOString() || '',
        updated_at: updatedNoteData.updated_at?.toISOString() || '',
    }; //


    return NextResponse.json<ApiResponse<Note>>({ success: true, data: updatedNote, message: 'Note updated successfully' }); //
  } catch (error) {
    // ... (error handling remains the same) ...
    if (error instanceof Response) return error;
    console.error('[PUT /api/notes] Unexpected error updating note:', error);
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
         if (error.code === 'P2025') {
            return NextResponse.json<ApiResponse>({ success: false, error: 'Note not found.' }, { status: 404 });
         }
         console.error('Prisma Error updating note:', { code: error.code, meta: error.meta });
         return NextResponse.json<ApiResponse>({ success: false, error: 'Database error updating note.' }, { status: 500 });
     }
    const errorMessage = error instanceof Error ? error.message : 'Failed to update note';
    return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
  }
}


// --- DELETE function (Uses Prisma) ---
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request); //
    const url = new URL(request.url);
    const noteId = url.searchParams.get('id'); //

    if (!noteId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Note ID is required' }, { status: 400 }); //
    }

    // ... (ownership verification remains the same) ...
     const existingNote = await prisma.notes.findUnique({
        where: { id: noteId },
        select: { user_id: true }
    });

     if (!existingNote) {
         return NextResponse.json<ApiResponse>({ success: true, message: 'Note not found or already deleted' });
     }
    if (existingNote.user_id !== user.id) {
       return NextResponse.json<ApiResponse>({ success: false, error: 'Access denied' }, { status: 403 }); //
    }

    // --- NEW: Delete embeddings associated with this note ---
    // We can do this asynchronously without awaiting.
    prisma.content_embeddings.deleteMany({
      where: { content_id: noteId, content_type: 'note', user_id: user.id }
    }).catch(err => {
      console.error(`Failed to delete embeddings for note ${noteId}:`, err);
    });
    // --- END NEW ---

    await prisma.notes.delete({
        where: { id: noteId }
    }); //

    return NextResponse.json<ApiResponse>({ success: true, message: 'Note deleted successfully' }); //
  } catch (error) {
    // ... (error handling remains the same) ...
    if (error instanceof Response) return error;
    console.error('[DELETE /api/notes] Unexpected error deleting note:', error);
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
         console.error('Prisma Error deleting note:', { code: error.code, meta: error.meta });
         return NextResponse.json<ApiResponse>({ success: false, error: 'Database error deleting note.' }, { status: 500 });
     }
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete note';
    return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
  }
}