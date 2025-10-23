import { NextRequest, NextResponse } from 'next/server';
import { supabaseHelpers } from '@/lib/supabase';
import { requireAuth, validateRequestBody } from '@/lib/auth';
import { validateNoteCreation } from '@/lib/usage-limits';
import { ApiResponse, NotesResponse, CreateNoteData, UpdateNoteData } from '@/types/database';

// POST /api/notes - Create a new note
export async function POST(request: NextRequest) {
  try {
    // Step 1: Authenticate user
    console.log('Step 1: Authenticating user...');
    let user;
    try {
      user = await requireAuth(request);
      console.log('✓ User authenticated:', user.id);
    } catch (authError) {
      console.error('✗ Authentication failed:', authError);
      if (authError instanceof Response) {
        return authError;
      }
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Authentication failed'
      }, { status: 401 });
    }

    // Step 2: Parse request body
    console.log('Step 2: Parsing request body...');
    let body: CreateNoteData;
    try {
      body = await request.json();
      console.log('✓ Body parsed:', { title: body.title?.substring(0, 20), hasContent: !!body.content });
    } catch (parseError) {
      console.error('✗ Failed to parse body:', parseError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Invalid JSON in request body'
      }, { status: 400 });
    }

    // Step 3: Validate input
    console.log('Step 3: Validating input...');
    const validation = validateRequestBody(body, ['title', 'content']);
    if (!validation.isValid) {
      console.error('✗ Validation failed:', validation.error);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: validation.error
      }, { status: 400 });
    }
    console.log('✓ Input validated');

    // Step 4: Check usage limits
    console.log('Step 4: Checking usage limits...');
    let limitValidation;
    try {
      limitValidation = await validateNoteCreation(user.id);
      console.log('✓ Limit validation result:', limitValidation);
    } catch (limitError) {
      console.error('✗ Limit validation error:', limitError);
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Failed to check usage limits'
      }, { status: 500 });
    }

    if (!limitValidation.isValid) {
      console.log('✗ Usage limit exceeded');
      return NextResponse.json<ApiResponse>({
        success: false,
        error: limitValidation.error,
        message: limitValidation.message
      }, { status: 403 });
    }
    console.log('✓ Usage limits OK');

    // Step 5: Create note in database
    console.log('Step 5: Creating note in database...');
    console.log('Data to insert:', { 
      userId: user.id, 
      titleLength: body.title.trim().length,
      contentLength: body.content.trim().length 
    });
    
    let note;
    try {
      note = await supabaseHelpers.createNote(
        user.id, 
        body.title.trim(), 
        body.content.trim()
      );
      console.log('✓ Note created successfully:', note.id);
    } catch (dbError: any) {
      console.error('✗ Database error details:', {
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint,
        name: dbError.name,
        stack: dbError.stack
      });
      
      // Return a more helpful error message
      let errorMessage = 'Failed to create note';
      if (dbError.code === '42501') {
        errorMessage = 'Permission denied. Please check your database Row Level Security policies.';
      } else if (dbError.code === '23505') {
        errorMessage = 'A note with this information already exists.';
      } else if (dbError.message) {
        errorMessage = dbError.message;
      }
      
      return NextResponse.json<ApiResponse>({
        success: false,
        error: errorMessage
      }, { status: 500 });
    }
    
    console.log('✓ POST /api/notes completed successfully');
    return NextResponse.json<ApiResponse>({
      success: true,
      data: note,
      message: 'Note created successfully'
    });
    
  } catch (error: any) {
    // Catch-all error handler
    console.error('✗ Unexpected error in POST /api/notes:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    if (error instanceof Response) {
      return error;
    }
    
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Internal server error: ' + (error.message || 'Unknown error')
    }, { status: 500 });
  }
}

// GET /api/notes - List all notes for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const userPlan = await supabaseHelpers.getUserWithPlan(user.id);
    const notes = await supabaseHelpers.getNotes(user.id);
    const currentCount = await supabaseHelpers.getNotesCount(user.id);
    
    const limit = userPlan.subscription_plan === 'pro' ? Infinity : 10;
    
    const response: ApiResponse<NotesResponse> = {
      success: true,
      data: {
        notes,
        count: currentCount,
        limit
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error('Error fetching notes:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch notes'
    }, { status: 500 });
  }
}

// PUT /api/notes - Update a note
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const noteId = url.searchParams.get('id');
    
    if (!noteId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Note ID is required'
      }, { status: 400 });
    }

    const body: UpdateNoteData = await request.json();
    const { title, content } = body;

    if (!title && !content) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Title or content is required for update'
      }, { status: 400 });
    }

    const existingNote = await supabaseHelpers.getNote(noteId);
    if (existingNote.user_id !== user.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    const updates: { title?: string; content?: string } = {};
    if (title !== undefined) {
      if (title.trim().length === 0) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Title cannot be empty'
        }, { status: 400 });
      }
      updates.title = title.trim();
    }
    
    if (content !== undefined) {
      if (content.trim().length === 0) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: 'Content cannot be empty'
        }, { status: 400 });
      }
      updates.content = content.trim();
    }

    const updatedNote = await supabaseHelpers.updateNote(noteId, updates);
    
    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedNote,
      message: 'Note updated successfully'
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error('Error updating note:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to update note'
    }, { status: 500 });
  }
}

// DELETE /api/notes - Delete a note
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const noteId = url.searchParams.get('id');
    
    if (!noteId) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Note ID is required'
      }, { status: 400 });
    }

    const existingNote = await supabaseHelpers.getNote(noteId);
    if (existingNote.user_id !== user.id) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Access denied'
      }, { status: 403 });
    }

    await supabaseHelpers.deleteNote(noteId);
    
    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    console.error('Error deleting note:', error);
    return NextResponse.json<ApiResponse>({
      success: false,
      error: 'Failed to delete note'
    }, { status: 500 });
  }
}