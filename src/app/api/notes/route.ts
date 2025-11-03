// src/app/api/notes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, validateRequestBody } from '@/lib/auth';
// --- MODIFIED: Import specific validator ---
import { USAGE_LIMITS, validateNoteCreation } from '@/lib/usage-limits';
import { ApiResponse, CreateNoteData, UpdateNoteData, Note, NoteListItem, PaginatedNotesResponse } from '@/types/database';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { generateEmbeddingsForContent } from '@/lib/embedding'; // <-- NEW IMPORT

// --- GET function (Unchanged) ---
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '9', 10);
    const skip = (page - 1) * limit;

    // Fetch user's subscription plan
    const userProfile = await prisma.profiles.findUnique({
      where: { id: user.id },
      select: { subscription_plan: true },
    });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
    const usageLimit = plan === 'pro' ? Infinity : USAGE_LIMITS.FREE_NOTES;

    // Fetch initial notes and total count
    const [notesData, totalCount] = await prisma.$transaction([
      prisma.notes.findMany({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: skip,
        select: {
          id: true,
          user_id: true,
          title: true,
          created_at: true,
          updated_at: true,
          tags: true,
        },
      }),
      prisma.notes.count({
        where: { user_id: user.id },
      }),
    ]);

    // Serialize dates
    const notes: NoteListItem[] = notesData.map((note) => ({
      ...note,
      tags: note.tags || [],
      created_at: note.created_at?.toISOString() || '',
      updated_at: note.updated_at?.toISOString() || '',
    }));

    const totalPages = Math.ceil(totalCount / limit);

    const responseData: PaginatedNotesResponse = {
      notes,
      count: totalCount,
      limit: usageLimit,
      totalPages,
      currentPage: page,
    };

    return NextResponse.json<ApiResponse<PaginatedNotesResponse>>({
      success: true,
      data: responseData,
    });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error('[GET /api/notes] Error fetching notes:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch notes' },
      { status: 500 }
    );
  }
}

// --- POST function (Uses Prisma) ---
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // --- MODIFIED: Use validator ---
    let limitValidation = await validateNoteCreation(user.id);
    if (!limitValidation.isValid) {
      return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: limitValidation.error, // This will be "limit_exceeded"
          message: limitValidation.message 
      }, { status: 403 });
    }
    // --- END MODIFICATION ---

    let body: CreateNoteData;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON in request body' }, { status: 400 });
    }
    
    // Title and Content are validated by the client editor, but we double-check
    const validation = validateRequestBody(body, ['title', 'content']);
    if (!validation.isValid) {
      return NextResponse.json<ApiResponse>({ success: false, error: validation.error }, { status: 400 });
    }
    
    const newNote = await prisma.notes.create({
        data: {
            user_id: user.id,
            title: body.title.trim(),
            content: body.content.trim(), // Storing HTML content
            tags: body.tags || [],
            linked_note_ids: body.linked_note_ids || [], // <-- ADD THIS
        }
    });

    // ... (embedding generation remains the same) ...
    generateEmbeddingsForContent(newNote.id, 'note', newNote.content, user.id)
      .catch(err => {
        console.error(`Failed to generate embeddings for note ${newNote.id}:`, err);
      });

    const responseNote: Note = {
        ...newNote,
        tags: newNote.tags || [],
        linked_note_ids: newNote.linked_note_ids || [], // <-- MODIFIED (ensure array)
        created_at: newNote.created_at?.toISOString() || '',
        updated_at: newNote.updated_at?.toISOString() || '',
    };

    return NextResponse.json<ApiResponse<Note>>({ success: true, data: responseNote, message: 'Note created successfully' }, { status: 201 });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error('[POST /api/notes] Error creating note:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('Prisma Error creating note:', {
        code: error.code,
        meta: error.meta,
      });
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Database error occurred while creating note.' },
        { status: 500 }
      );
    }
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to create note' },
      { status: 500 }
    );
  }
}


// --- PUT function (Uses Prisma) ---
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const noteId = url.searchParams.get('id');

    if (!noteId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Note ID is required' }, { status: 400 });
    }

    const body: UpdateNoteData = await request.json();
    const { title, content, tags, linked_note_ids } = body; // <-- ADD linked_note_ids

    if (title === undefined && content === undefined && tags === undefined && linked_note_ids === undefined) { // <-- ADD linked_note_ids
      return NextResponse.json<ApiResponse>({ success: false, error: 'Title, content, tags, or linked_note_ids is required for update' }, { status: 400 });
    }

    // ... (ownership verification remains the same) ...
    const existingNote = await prisma.notes.findFirst({ // Use findFirst for RLS
        where: { id: noteId, user_id: user.id },
        select: { user_id: true }
    });
    if (!existingNote) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Note not found or access denied' }, { status: 404 });
    }

    const updates: Prisma.notesUpdateInput = {};
    if (title !== undefined) {
      if (title.trim().length === 0) return NextResponse.json<ApiResponse>({ success: false, error: 'Title cannot be empty' }, { status: 400 });
      updates.title = title.trim();
    }
    if (content !== undefined) {
       updates.content = content.trim(); // Saving HTML
     }
    if (tags !== undefined && Array.isArray(tags)) {
        updates.tags = tags;
    }
    if (linked_note_ids !== undefined && Array.isArray(linked_note_ids)) { // <-- ADD THIS BLOCK
        updates.linked_note_ids = linked_note_ids;
    }

    if (Object.keys(updates).length === 0) return NextResponse.json<ApiResponse>({ success: false, error: 'No valid fields provided for update' }, { status: 400 });

    const updatedNoteData = await prisma.notes.update({
        where: { id: noteId },
        data: updates
    });

    // ... (embedding re-generation remains the same) ...
    if (content !== undefined) {
      generateEmbeddingsForContent(updatedNoteData.id, 'note', updatedNoteData.content, user.id)
        .catch(err => {
          console.error(`Failed to RE-generate embeddings for note ${updatedNoteData.id}:`, err);
        });
    }

    const updatedNote: Note = {
        ...updatedNoteData,
        tags: updatedNoteData.tags || [],
        linked_note_ids: updatedNoteData.linked_note_ids || [], // <-- MODIFIED (ensure array)
        created_at: updatedNoteData.created_at?.toISOString() || '',
        updated_at: updatedNoteData.updated_at?.toISOString() || '',
    };


    return NextResponse.json<ApiResponse<Note>>({ success: true, data: updatedNote, message: 'Note updated successfully' });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('[PUT /api/notes] Error updating note:', error);
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      console.error('Prisma Error updating note:', {
        code: error.code,
        meta: error.meta,
      });
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Database error occurred while updating note.' },
        { status: 500 }
      );
    }
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to update note' },
      { status: 500 }
    );
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