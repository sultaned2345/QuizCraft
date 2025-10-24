// src/app/api/notes/route.ts
import { NextRequest, NextResponse } from 'next/server';
// Make sure createClient is imported
import { createClient } from '@supabase/supabase-js';
import { supabaseHelpers } from '@/lib/supabase'; // Keep original helpers for potential reuse elsewhere
import { requireAuth, validateRequestBody } from '@/lib/auth';
// Import USAGE_LIMITS directly if needed for validation logic here
import { USAGE_LIMITS } from '@/lib/usage-limits';
import { ApiResponse, CreateNoteData, UpdateNoteData, Note } from '@/types/database';

// --- Helper to get scoped Supabase client ---
function getSupabaseClientForUser(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
        throw new Error("Missing auth token for scoped client creation");
    }
    // Use the same URL/Key as your global client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    return createClient(supabaseUrl, supabaseAnonKey, {
        global: {
            headers: { Authorization: `Bearer ${token}` }
        }
    });
}
// --- Modified validateNoteCreation to accept a client ---
async function validateNoteCreationWithClient(userId: string, supabaseClient: any): Promise<{ isValid: boolean; error?: string; message?: string; }> {
  try {
    console.log('[Scoped] Validating note creation for user:', userId);

    // Fetch user profile using the scoped client
    const { data: userProfile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('subscription_plan')
      .eq('id', userId)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
        console.error('[Scoped] Error fetching user profile:', profileError);
        // Don't throw, proceed assuming free plan on error
    } else if (!userProfile) {
        console.warn(`[Scoped] No profile found for user ${userId}, assuming 'free' plan.`);
    }

    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
    console.log('[Scoped] User plan found:', plan);

    if (plan !== 'pro') {
      // Get count using the scoped client
      const { count, error: countError } = await supabaseClient
        .from('notes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
         console.error('[Scoped] Error counting notes:', countError);
         // Don't block on count error, proceed cautiously
      } else {
          const currentCount = count ?? 0;
          console.log('[Scoped] Current note count:', currentCount, '/', USAGE_LIMITS.FREE_NOTES);
          if (currentCount >= USAGE_LIMITS.FREE_NOTES) {
            return {
              isValid: false,
              error: 'Note limit reached',
              message: `You have reached the maximum number of notes (${USAGE_LIMITS.FREE_NOTES}) for free users. Upgrade to Pro for unlimited notes.`
            };
          }
      }
    }
    return { isValid: true };
  } catch (error: any) {
    console.error('[Scoped] Validation error:', error);
    // Be permissive on validation errors
    return { isValid: true };
  }
}

// --- Modified POST function ---
export async function POST(request: NextRequest) {
  try {
    let user;
    try {
      user = await requireAuth(request);
      console.log('API Route - User ID from requireAuth:', user.id);
    } catch (authError) {
      console.error('Authentication failed:', authError);
      if (authError instanceof Response) return authError;
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication failed' }, { status: 401 });
    }

    // --- Create scoped client ---
    const supabaseForUser = getSupabaseClientForUser(request);

    let body: CreateNoteData;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error('Failed to parse body:', parseError);
      return NextResponse.json<ApiResponse>({ success: false, error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const validation = validateRequestBody(body, ['title', 'content']);
    if (!validation.isValid) {
      console.error('Validation failed:', validation.error);
      return NextResponse.json<ApiResponse>({ success: false, error: validation.error }, { status: 400 });
    }

    // --- Use scoped client for validation ---
    let limitValidation = await validateNoteCreationWithClient(user.id, supabaseForUser);
    if (!limitValidation.isValid) {
      console.log('Usage limit exceeded');
      return NextResponse.json<ApiResponse>({ success: false, error: limitValidation.error, message: limitValidation.message }, { status: 403 });
    }

    // --- Use scoped client for insertion ---
    let note: Note;
    try {
       const { data, error } = await supabaseForUser
          .from('notes')
          .insert({ user_id: user.id, title: body.title.trim(), content: body.content.trim() })
          .select()
          .single();

       if (error) throw error; // Let the outer catch handle Supabase errors
       if (!data) throw new Error("Insert succeeded but no data returned.");
       note = data;

    } catch (dbError: any) {
      // Log Supabase specific details if available
      console.error('[Scoped] Database error creating note:', {
        message: dbError.message, code: dbError.code, details: dbError.details, hint: dbError.hint
      });
      // Use a generic message for the client
      return NextResponse.json<ApiResponse>({ success: false, error: 'Database error: Failed to create note' }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Note>>({ success: true, data: note, message: 'Note created successfully' });

  } catch (error: any) {
    console.error('Unexpected error in POST /api/notes:', { message: error.message, stack: error.stack, name: error.name });
    if (error instanceof Response) return error; // Handle requireAuth rejections
    // Handle errors from getSupabaseClientForUser
    if (error.message.includes("Missing auth token")) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication token missing' }, { status: 401 });
    }
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error: ' + (error.message || 'Unknown error') }, { status: 500 });
  }
}

// Keep GET, PUT, DELETE functions as they were, but they might need similar scoping adjustments if they show similar issues.
// ... (rest of the file with GET, PUT, DELETE - unchanged for now)
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    // For GET, we might need a scoped client too if RLS issues appear
    const supabaseForUser = getSupabaseClientForUser(request);

    const { data: userProfile, error: profileError } = await supabaseForUser
      .from('profiles')
      .select('subscription_plan')
      .eq('id', user.id)
      .maybeSingle();

    // Handle profile errors or missing profiles like before
    if (profileError && profileError.code !== 'PGRST116') {
        console.error('[Scoped GET] Error fetching user profile:', profileError);
    }
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
    const limit = plan === 'pro' ? Infinity : USAGE_LIMITS.FREE_NOTES;

    // Use scoped client for fetching notes and count
    const [notesResult, countResult] = await Promise.all([
        supabaseForUser.from('notes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabaseForUser.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    ]);

    if (notesResult.error) throw notesResult.error;
    if (countResult.error) throw countResult.error;

    const notes = notesResult.data || [];
    const currentCount = countResult.count ?? 0;

    const responseData = { notes, count: currentCount, limit };

    return NextResponse.json<ApiResponse<typeof responseData>>({
      success: true,
      data: responseData,
    });

  } catch (error) {
     if (error instanceof Response) return error; // Handle requireAuth or scoped client creation errors
     console.error('[Scoped GET] Error fetching notes:', error);
     const errorMessage = error instanceof Error ? error.message : 'Failed to fetch notes';
     return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
  }
}

// ... (PUT and DELETE would need similar changes using supabaseForUser)
// For PUT: Fetch existingNote and perform update using supabaseForUser
// For DELETE: Fetch existingNote and perform delete using supabaseForUser

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

    // --- Create scoped client ---
    const supabaseForUser = getSupabaseClientForUser(request);

    // --- Fetch existing note using scoped client ---
    const { data: existingNote, error: fetchError } = await supabaseForUser
        .from('notes')
        .select('user_id') // Only need user_id for ownership check
        .eq('id', noteId)
        .single();

    if (fetchError) {
        // Handle potential errors like note not found (PGRST116) or others
        const status = fetchError.code === 'PGRST116' ? 404 : 500;
        const message = fetchError.code === 'PGRST116' ? 'Note not found' : 'Failed to retrieve note for update check';
        console.error(`[Scoped PUT] Error fetching note ${noteId}:`, fetchError);
        return NextResponse.json<ApiResponse>({ success: false, error: message }, { status });
    }

    if (existingNote.user_id !== user.id) {
      console.warn(`[Scoped PUT] Access denied for user ${user.id} trying to update note ${noteId} owned by ${existingNote.user_id}`);
      return NextResponse.json<ApiResponse>({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const updates: Partial<Pick<Note, 'title' | 'content'>> = {};
     if (title !== undefined) {
      if (title.trim().length === 0) return NextResponse.json<ApiResponse>({ success: false, error: 'Title cannot be empty' }, { status: 400 });
      updates.title = title.trim();
    }
     if (content !== undefined) {
       if (content.trim().length === 0) return NextResponse.json<ApiResponse>({ success: false, error: 'Content cannot be empty' }, { status: 400 });
       updates.content = content.trim();
     }
    if (Object.keys(updates).length === 0) return NextResponse.json<ApiResponse>({ success: false, error: 'No valid fields provided for update' }, { status: 400 });


    // --- Perform update using scoped client ---
    const { data: updatedNote, error: updateError } = await supabaseForUser
      .from('notes')
      .update(updates)
      .eq('id', noteId)
      .select()
      .single();

    if (updateError) {
        console.error(`[Scoped PUT] Error updating note ${noteId}:`, updateError);
        return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to update note' }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Note>>({ success: true, data: updatedNote, message: 'Note updated successfully' });
  } catch (error) {
    if (error instanceof Response) return error; // Handle requireAuth or scoped client creation errors
    console.error('[Scoped PUT] Unexpected error updating note:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update note';
    return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
  }
}


export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const noteId = url.searchParams.get('id');

    if (!noteId) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Note ID is required' }, { status: 400 });
    }

    // --- Create scoped client ---
    const supabaseForUser = getSupabaseClientForUser(request);

    // --- Fetch existing note using scoped client ---
     const { data: existingNote, error: fetchError } = await supabaseForUser
        .from('notes')
        .select('user_id') // Only need user_id for ownership check
        .eq('id', noteId)
        .maybeSingle(); // maybeSingle handles not found gracefully

     if (fetchError && fetchError.code !== 'PGRST116') { // Ignore 'not found' error here
        console.error(`[Scoped DELETE] Error fetching note ${noteId} for ownership check:`, fetchError);
        return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to check note ownership' }, { status: 500 });
     }

     if (!existingNote) {
         // Note already deleted or never existed, arguably a success for DELETE
         // Alternatively, return 404: return NextResponse.json<ApiResponse>({ success: false, error: 'Note not found' }, { status: 404 });
         console.log(`[Scoped DELETE] Note ${noteId} not found, deletion skipped.`);
         return NextResponse.json<ApiResponse>({ success: true, message: 'Note not found or already deleted' });
     }

    if (existingNote.user_id !== user.id) {
       console.warn(`[Scoped DELETE] Access denied for user ${user.id} trying to delete note ${noteId} owned by ${existingNote.user_id}`);
      return NextResponse.json<ApiResponse>({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // --- Perform delete using scoped client ---
    const { error: deleteError } = await supabaseForUser
      .from('notes')
      .delete()
      .eq('id', noteId);

    if (deleteError) {
         console.error(`[Scoped DELETE] Error deleting note ${noteId}:`, deleteError);
        return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to delete note' }, { status: 500 });
    }

    return NextResponse.json<ApiResponse>({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    if (error instanceof Response) return error; // Handle requireAuth or scoped client creation errors
    console.error('[Scoped DELETE] Unexpected error deleting note:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete note';
    return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
  }
}