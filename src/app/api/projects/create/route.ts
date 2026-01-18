import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession';

export async function POST(req: Request) {
  try {
    // 1. Authenticate User
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Request Body
    // We accept 'initialDocumentId' to support the Turbo Upload flow
    const { title, description, initialDocumentId } = await req.json();

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // 3. Create the Project
    const project = await prisma.projects.create({
      data: {
        user_id: session.user.id,
        title,
        description: description || '',
      },
    });

    // 4. (Optional) Link the Initial Document
    // If this project was created from an upload, we immediately link the file
    if (initialDocumentId) {
      
      // Verify the user owns this document first for security
      const doc = await prisma.documents.findUnique({
        where: { id: initialDocumentId, user_id: session.user.id }
      });

      if (doc) {
        // Create the link in the pivot table (project_content_links)
        await prisma.project_content_links.create({
          data: {
            user_id: session.user.id,
            project_id: project.id,
            content_id: initialDocumentId,
            content_type: 'document' 
          }
        });
        console.log(`[Project Created] Linked Document ${initialDocumentId} to Project ${project.id}`);
      } else {
        console.warn(`[Project Warning] User tried to link unauthorized doc: ${initialDocumentId}`);
      }
    }

    return NextResponse.json({ success: true, project });

  } catch (error: any) {
    console.error('Create Project Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create project' },
      { status: 500 }
    );
  }
}