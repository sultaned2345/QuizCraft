import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseHelpers } from '@/lib/supabase';
import { requireAuth, validateRequestBody } from '@/lib/auth';
import { validateNoteCreation, USAGE_LIMITS } from '@/lib/usage-limits';
import { ApiResponse, NotesResponse, CreateNoteData, UpdateNoteData, Note } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    let user;
    try {
      user = await requireAuth(request);
    } catch (authError) {
      console.error('Authentication failed:', authError);
      if (authError instanceof Response) return authError;
      return NextResponse.json<ApiResponse>({ success: false, error: 'Authentication failed' }, { status: 401 });
    }

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

    let limitValidation;
    try {
      limitValidation = await validateNoteCreation(user.id);
    } catch (limitError) {
      console.error('Limit validation error:', limitError);
      return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to check usage limits' }, { status: 500 });
    }

    if (!limitValidation.isValid) {
      console.log('Usage limit exceeded');
      return NextResponse.json<ApiResponse>({ success: false, error: limitValidation.error, message: limitValidation.message }, { status: 403 });
    }

    let note: Note;
    try {
      note = await supabaseHelpers.createNote(
        user.id,
        body.title.trim(),
        body.content.trim()
      );
    } catch (dbError: any) {
      console.error('Database error creating note:', {
        message: dbError.message, code: dbError.code, details: dbError.details, hint: dbError.hint
      });
      return NextResponse.json<ApiResponse>({ success: false, error: 'Database error: ' + (dbError.message || 'Failed to create note') }, { status: 500 });
    }

    return NextResponse.json<ApiResponse<Note>>({ success: true, data: note, message: 'Note created successfully' });

  } catch (error: any) {
    console.error('Unexpected error in POST /api/notes:', { message: error.message, stack: error.stack, name: error.name });
    if (error instanceof Response) return error;
    return NextResponse.json<ApiResponse>({ success: false, error: 'Internal server error: ' + (error.message || 'Unknown error') }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching user profile:', profileError);
    }
    const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
    const limit = plan === 'pro' ? Infinity : USAGE_LIMITS.FREE_NOTES;

    const [notesResult, countResult] = await Promise.all([
        supabase.from('notes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('notes').select('*', { count: 'exact', head: true }).eq('user_id', user.id)
    ]);

    if (notesResult.error) throw notesResult.error;
    if (countResult.error) throw countResult.error;

    const notes = notesResult.data || [];
    const currentCount = countResult.count ?? 0;

    const responseData: NotesResponse = {
      notes,
      count: currentCount,
      limit,
    };

    return NextResponse.json<ApiResponse<NotesResponse>>({
      success: true,
      data: responseData,
    });

  } catch (error) {
    if (error instanceof Response) {
      console.error('Authentication error caught in GET /api/notes:', error.status);
      return error;
    }

    console.error('Error fetching notes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch notes';

    return NextResponse.json<ApiResponse>({
      success: false,
      error: errorMessage,
    }, { status: 500 });
  }
}

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

    const existingNote = await supabaseHelpers.getNote(noteId);
    if (existingNote.user_id !== user.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const updates: Partial<Pick<Note, 'title' | 'content'>> = {};
    if (title !== undefined) {
      if (title.trim().length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Title cannot be empty' }, { status: 400 });
      }
      updates.title = title.trim();
    }

    if (content !== undefined) {
      if (content.trim().length === 0) {
        return NextResponse.json<ApiResponse>({ success: false, error: 'Content cannot be empty' }, { status: 400 });
      }
      updates.content = content.trim();
    }

    if (Object.keys(updates).length === 0) {
         return NextResponse.json<ApiResponse>({ success: false, error: 'No valid fields provided for update' }, { status: 400 });
    }

    const updatedNote = await supabaseHelpers.updateNote(noteId, updates);

    return NextResponse.json<ApiResponse<Note>>({ success: true, data: updatedNote, message: 'Note updated successfully' });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error updating note:', error);
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

    const existingNote = await supabaseHelpers.getNote(noteId);
    if (existingNote.user_id !== user.id) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Access denied' }, { status: 403 });
    }

    await supabaseHelpers.deleteNote(noteId);

    return NextResponse.json<ApiResponse>({ success: true, message: 'Note deleted successfully' });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('Error deleting note:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete note';
    return NextResponse.json<ApiResponse>({ success: false, error: errorMessage }, { status: 500 });
  }
}


I've updated the file with the necessary authentication error handling in the `GET` route and removed all the comments as requested. This version maintains the functionality and performance improvements discussed earlier.