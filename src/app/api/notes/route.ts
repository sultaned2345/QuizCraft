// src/app/api/notes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, validateRequestBody } from '@/lib/auth';
import { validateNoteCreation } from '@/lib/usage-limits';
import { ApiResponse, CreateNoteData, NoteListItem, PaginatedNotesResponse } from '@/types/database';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { generateEmbeddingsForContent } from '@/lib/embedding';

export const runtime = 'nodejs';

// --- GET: List Notes (With Search, Tags & Pagination) ---
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    
    // Parse Query Parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const search = url.searchParams.get('search') || '';
    const tag = url.searchParams.get('tag') || '';
    
    const skip = (page - 1) * limit;

    // Build Prisma "Where" Clause
    const whereClause: Prisma.notesWhereInput = {
        user_id: user.id,
        // Search by Title (Case Insensitive)
        ...(search ? { 
            title: { contains: search, mode: 'insensitive' } 
        } : {}),
        // Filter by Tag (if not 'all')
        ...(tag && tag !== 'all' ? { 
            tags: { has: tag } 
        } : {}),
    };

    // Execute Query (Fetch Data + Total Count)
    const [notesData, totalCount] = await prisma.$transaction([
      prisma.notes.findMany({
        where: whereClause,
        orderBy: { updated_at: 'desc' }, // Sort by most recently updated
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
      prisma.notes.count({ where: whereClause }),
    ]);

    // Format Response
    const notes: NoteListItem[] = notesData.map((note) => ({
      ...note,
      tags: note.tags || [],
      created_at: note.created_at ? note.created_at.toISOString() : new Date().toISOString(),
      updated_at: note.updated_at ? note.updated_at.toISOString() : new Date().toISOString(),
    }));

    return NextResponse.json<ApiResponse<PaginatedNotesResponse>>({
      success: true,
      data: {
        notes,
        count: totalCount,
        limit: limit,
        totalPages: Math.ceil(totalCount / limit),
        currentPage: page,
      },
    });

  } catch (error: any) {
    if (error instanceof Response) return error; // Handle auth errors
    console.error('[GET /api/notes] Error:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to fetch notes' }, { status: 500 });
  }
}

// --- POST: Create New Note ---
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // 1. Check Usage Limits (prevent abuse)
    const limitValidation = await validateNoteCreation(user.id);
    if (!limitValidation.isValid) {
      return NextResponse.json<ApiResponse>({ 
          success: false, 
          error: limitValidation.error, 
          message: limitValidation.message 
      }, { status: 403 });
    }

    // 2. Validate Body
    const body: CreateNoteData = await request.json();
    const validation = validateRequestBody(body, ['title']);
    
    if (!validation.isValid) {
      return NextResponse.json<ApiResponse>({ success: false, error: validation.error }, { status: 400 });
    }
    
    // 3. Create Note in Database
    const newNote = await prisma.notes.create({
        data: {
            user_id: user.id,
            title: body.title.trim() || 'Untitled Note',
            content: body.content?.trim() || '',
            tags: body.tags || [], // Ensure tags are stored if passed
            linked_note_ids: body.linked_note_ids || [],
        }
    });

    // 4. Generate Embeddings (Async - don't block response)
    // This allows the note to be searchable by semantic meaning later
    if (newNote.content && newNote.content.length > 20) {
      generateEmbeddingsForContent(newNote.id, 'note', newNote.content, user.id)
        .catch(err => console.error(`Embedding error for note ${newNote.id}:`, err));
    }

    // 5. Return Success
    return NextResponse.json<ApiResponse>({ 
        success: true, 
        data: {
            ...newNote,
            tags: newNote.tags || [],
            linked_note_ids: newNote.linked_note_ids || [],
            // FIX: Added null checks for dates
            created_at: newNote.created_at ? newNote.created_at.toISOString() : new Date().toISOString(),
            updated_at: newNote.updated_at ? newNote.updated_at.toISOString() : new Date().toISOString(),
        }, 
        message: 'Note created successfully' 
    }, { status: 201 });

  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error('[POST /api/notes] Error:', error);
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to create note' }, { status: 500 });
  }
}