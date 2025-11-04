// src/app/api/projects/route.ts
// NEW FILE

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, Project } from '@/types/database';

export const runtime = 'nodejs';

// GET /api/projects
// Fetches all projects for the user, with a count of items in each.
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const projects = await prisma.projects.findMany({
      where: { user_id: user.id },
      include: {
        _count: {
          select: { links: true },
        },
      },
      orderBy: { updated_at: 'desc' },
    });

    return NextResponse.json<ApiResponse<Project[]>>({
      success: true,
      data: projects.map(p => ({
        ...p,
        description: p.description || null,
        created_at: p.created_at?.toISOString() || '',
        updated_at: p.updated_at?.toISOString() || '',
      })),
    });
  } catch (error: any) {
    if (error instanceof Response) return error;
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to fetch projects.' }, { status: 500 });
  }
}

// POST /api/projects
// Creates a new, empty project.
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { title, description } = await request.json();

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json<ApiResponse>({ success: false, error: 'Title is required.' }, { status: 400 });
    }

    const newProject = await prisma.projects.create({
      data: {
        user_id: user.id,
        title: title.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json<ApiResponse<Project>>({
      success: true,
      data: {
        ...newProject,
        description: newProject.description || null,
        created_at: newProject.created_at?.toISOString() || '',
        updated_at: newProject.updated_at?.toISOString() || '',
      },
      message: 'Project created successfully.'
    }, { status: 201 });

  } catch (error: any) {
    if (error instanceof Response) return error;
    return NextResponse.json<ApiResponse>({ success: false, error: 'Failed to create project.' }, { status: 500 });
  }
}