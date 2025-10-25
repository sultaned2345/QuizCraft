// src/app/api/notes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'; // Keep if used elsewhere or for validation client
import { requireAuth } from '@/lib/auth';
import { USAGE_LIMITS } from '@/lib/usage-limits';
import { ApiResponse, CreateNoteData, UpdateNoteData, Note } from '@/types/database';
import { prisma } from '@/lib/prisma'; // Use Prisma for data operations
import { Prisma } from '@prisma/client'; // Import Prisma for types if needed

// Define a type for the paginated response data
interface PaginatedNotesResponse {
  notes: Note[];
  count: number; // Total count of notes for the user
  limit: number | typeof Infinity; // Usage limit for the plan
  totalPages: number;
  currentPage: number;
}

// Helper can be removed if not using scoped Supabase client for validation anymore
// function getSupabaseClientForUser(...) { ... }

// Validation function updated to use Prisma
async function validateNoteCreation(userId: string): Promise<{ isValid: boolean; error?: string; message?: string; }> {
  try {
    const userProfile = await prisma.profiles.findUnique({
        where: { id: userId },
        select: { subscription_plan: true }
    });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';

    if (plan !== 'pro') {
      const currentCount = await prisma.notes.count({ where: { user_id: userId } });
      if (currentCount >= USAGE_LIMITS.FREE_NOTES) {
        return {
          isValid: false,
          error: 'Note limit reached',
          message: `You have reached the maximum number of notes (${USAGE_LIMITS.FREE_NOTES}) for free users. Upgrade to Pro for unlimited notes.`
        };
      }
    }
    return { isValid: true };
  } catch (error: any) {
    console.error('Note creation validation error:', error);
    return { isValid: true }; // Be permissive on error
  }
}


// --- UPDATED GET function with Pagination ---
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // --- Pagination Parameters ---
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '9', 10); // Default to 9 per page (match grid)
    const skip = (page - 1) * limit;

    // Fetch user's subscription plan using Prisma
    const userProfile = await prisma.profiles.findUnique({
        where: { id: user.id },
        select: { subscription_plan: true },
    });
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
    const usageLimit = plan === 'pro' ? Infinity : USAGE_LIMITS.FREE_NOTES;

    // Use Prisma for fetching notes and total count in a transaction
    const [notesData, totalCount] = await prisma.$transaction([
        prisma.notes.findMany({
            where: { user_id: user.id },
            orderBy: { created_at: 'desc' },
            take: limit,
            skip: skip,
            // Select only necessary fields for list view if needed later
            // select: { id: true, title: true, content: true, created_at: true, updated_at: true }
        }),
        prisma.notes.count({
            where: { user_id: user.id },
        }),
    ]);

    // Ensure dates are serialized correctly (Prisma usually handles this, but explicit conversion is safe)
    const notes = notesData.map(note => ({
        ...note,
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

  } catch (error) {
     if (error instanceof Response) return error;
     console.error('[GET /api/notes] Error fetching notes:', error);
     const errorMessage = error instanceof Error ? error.message : 'Failed to fetch notes';
     return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
  }
}

// --- POST function (Uses Prisma) ---
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Validate usage limits using Prisma-based function
    let limitValidation = await validateNoteCreation(user.id);
    if (!limitValidation.isValid) {
      return NextResponse.json<ApiResponse>({ success: false, error: limitValidation.error, message: limitValidation.message }, { status: 403 });
    }

    let body: CreateNoteData;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON in request body' }, { status: 400 });
    }
    // Validation helper remains useful
    const { validateRequestBody } = await import('@/lib/auth'); // Re-import locally if needed
    const validation = validateRequestBody(body, ['title', 'content']);
    if (!validation.isValid) {
      return NextResponse.json<ApiResponse>({ success: false, error: validation.error }, { status: 400 });
    }

    // --- Use Prisma for insertion ---
    const newNote = await prisma.notes.create({
        data: {
            user_id: user.id,
            title: body.title.trim(),
            content: body.content.trim(),
        }
    });

    // Serialize dates
    const responseNote = {
        ...newNote,
        created_at: newNote.created_at?.toISOString() || '',
        updated_at: newNote.updated_at?.toISOString() || '',
    };

    return NextResponse.json<ApiResponse<Note>>({ success: true, data: responseNote, message: 'Note created successfully' }, { status: 201 });

  } catch (error: any) {
    console.error('Unexpected error in POST /api/notes:', error);
     if (error instanceof Response) return error; // Handle requireAuth rejections
     // Handle Prisma errors specifically
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
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const noteId = url.searchParams.get('id');

    if (!noteId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Note ID is required' }, { status: 400 });
    }

    const body: UpdateNoteData = await request.json();
    const { title, content } = body;

    if (title === undefined && content === undefined) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Title or content is required for update' }, { status: 400 });
    }

    // --- Verify ownership using Prisma ---
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

    const updates: Prisma.notesUpdateInput = {}; // Use Prisma type for updates
    if (title !== undefined) {
      if (title.trim().length === 0) return NextResponse.json<ApiResponse>({ success: false, error: 'Title cannot be empty' }, { status: 400 });
      updates.title = title.trim();
    }
    if (content !== undefined) {
       if (content.trim().length === 0) return NextResponse.json<ApiResponse>({ success: false, error: 'Content cannot be empty' }, { status: 400 });
       updates.content = content.trim();
     }
    // Prisma's @updatedAt handles the timestamp automatically
    // updates.updated_at = new Date(); // No longer needed if using @updatedAt

    if (Object.keys(updates).length === 0) return NextResponse.json<ApiResponse>({ success: false, error: 'No valid fields provided for update' }, { status: 400 });


    // --- Perform update using Prisma ---
    const updatedNoteData = await prisma.notes.update({
        where: { id: noteId }, // Ownership already checked
        data: updates
    });

     // Serialize dates
    const updatedNote = {
        ...updatedNoteData,
        created_at: updatedNoteData.created_at?.toISOString() || '',
        updated_at: updatedNoteData.updated_at?.toISOString() || '',
    };


    return NextResponse.json<ApiResponse<Note>>({ success: true, data: updatedNote, message: 'Note updated successfully' });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('[PUT /api/notes] Unexpected error updating note:', error);
     // Handle Prisma errors (like P2025 not found, though checked above)
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
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const noteId = url.searchParams.get('id');

    if (!noteId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Note ID is required' }, { status: 400 });
    }

    // --- Verify ownership using Prisma ---
     const existingNote = await prisma.notes.findUnique({
        where: { id: noteId },
        select: { user_id: true }
    });

     if (!existingNote) {
         // Note already deleted or never existed
         // For DELETE, idempotency often means returning success even if not found
         return NextResponse.json<ApiResponse>({ success: true, message: 'Note not found or already deleted' });
         // If 404 is preferred: return NextResponse.json<ApiResponse>({ success: false, error: 'Note not found' }, { status: 404 });
     }
    if (existingNote.user_id !== user.id) {
       return NextResponse.json<ApiResponse>({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // --- Perform delete using Prisma ---
    await prisma.notes.delete({
        where: { id: noteId } // Ownership confirmed
    });

    return NextResponse.json<ApiResponse>({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('[DELETE /api/notes] Unexpected error deleting note:', error);
    // Handle Prisma errors (like P2025 not found, handled above)
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
         // P2025 (Record not found) is handled above, catch others
         console.error('Prisma Error deleting note:', { code: error.code, meta: error.meta });
         return NextResponse.json<ApiResponse>({ success: false, error: 'Database error deleting note.' }, { status: 500 });
     }
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete note';
    return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
  }
}