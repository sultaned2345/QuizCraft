// src/app/api/projects/[projectId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { ApiResponse, Project } from '@/types/database';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';

// PUT /api/projects/[projectId]
// Updates a project's title or description
export async function PUT(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await requireAuth(request);
    const { projectId } = params;
    const { title, description } = (await request.json()) as {
      title?: string;
      description?: string;
    };

    if (!title || title.trim().length === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Title is required.' },
        { status: 400 }
      );
    }

    const updateData: Prisma.projectsUpdateInput = {
      title: title.trim(),
      description: description?.trim() || null,
    };

    // Use updateMany to ensure we only update if the user_id matches
    const updateResult = await prisma.projects.updateMany({
      where: {
        id: projectId,
        user_id: user.id,
      },
      data: updateData,
    });

    if (updateResult.count === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Project not found or access denied.' },
        { status: 404 }
      );
    }

    // Fetch the updated project to return it
    const updatedProject = await prisma.projects.findUnique({
      where: { id: projectId },
      include: {
        _count: {
          select: { links: true },
        },
      },
    });

    return NextResponse.json<ApiResponse<Project>>({
      success: true,
      data: {
        ...updatedProject!,
        description: updatedProject!.description || null,
        created_at: updatedProject!.created_at?.toISOString() || '',
        updated_at: updatedProject!.updated_at?.toISOString() || '',
      },
    });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error(`[API /api/projects/PUT] Error:`, error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to update project.' },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[projectId]
// Deletes a project and its associated links (via cascade)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const user = await requireAuth(request);
    const { projectId } = params;

    // Use deleteMany to ensure user ownership
    const deleteResult = await prisma.projects.deleteMany({
      where: {
        id: projectId,
        user_id: user.id,
      },
    });

    if (deleteResult.count === 0) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Project not found or access denied.' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      message: 'Project deleted successfully.',
    });
  } catch (error: any) {
    if (error instanceof Response) return error;
    console.error(`[API /api/projects/DELETE] Error:`, error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to delete project.' },
      { status: 500 }
    );
  }
}