// src/app/(app)/projects/[projectId]/page.tsx
// NEW FILE

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession';
import { redirect } from 'next/navigation';
import { ProjectClientComponent } from './ProjectClientComponent';
import { Project, ProjectContentDetails } from '@/types/database';
// --- FIX: Add missing imports ---
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
// --- END FIX ---

export const dynamic = 'force-dynamic';

interface ProjectData {
  project: Project;
  contentDetails: ProjectContentDetails;
}

/**
 * Fetches the project details AND all its linked content.
 * This replicates the logic from the API route for better server-side rendering.
 */
async function getProjectData(projectId: string, userId: string): Promise<ProjectData | null> {
  try {
    // 1. Verify user owns the project and get its details
    const project = await prisma.projects.findFirst({
      where: { id: projectId, user_id: userId },
    });

    if (!project) {
      return null;
    }

    // 2. Get all links for this project
    const links = await prisma.project_content_links.findMany({
      where: { project_id: projectId, user_id: userId },
      orderBy: { created_at: 'asc' },
    });

    // 3. Group links by content type
    const contentIdsByType = links.reduce((acc, link) => {
      if (!acc[link.content_type]) {
        acc[link.content_type] = [];
      }
      acc[link.content_type].push(link.content_id);
      return acc;
    }, {} as Record<string, string[]>);

    // 4. Fetch details for each content type in parallel
    const promises = [];
    
    if (contentIdsByType.document) {
      promises.push(
        prisma.documents.findMany({
          where: { id: { in: contentIdsByType.document }, user_id: userId },
          select: { id: true, file_name: true, ai_summary: true }
        }).then(items => items.map(item => ({ ...item, type: 'document', title: item.file_name, desc: item.ai_summary })))
      );
    }
    if (contentIdsByType.quiz) {
      promises.push(
        prisma.quiz.findMany({
          where: { id: { in: contentIdsByType.quiz }, userId: userId },
          select: { id: true, title: true, _count: { select: { questions: true } } }
        }).then(items => items.map(item => ({ ...item, type: 'quiz', desc: `${item._count.questions} questions` })))
      );
    }
    if (contentIdsByType.note) {
      promises.push(
        prisma.notes.findMany({
          where: { id: { in: contentIdsByType.note }, user_id: userId },
          select: { id: true, title: true, content: true } // Get content for a snippet
        }).then(items => items.map(item => ({ ...item, type: 'note', desc: item.content.replace(/<[^>]+>/g, ' ').substring(0, 100) + '...' })))
      );
    }
    if (contentIdsByType.deck) {
      promises.push(
        prisma.flashcard_decks.findMany({
          where: { id: { in: contentIdsByType.deck }, user_id: userId },
          select: { id: true, title: true, _count: { select: { flashcards: true } } }
        }).then(items => items.map(item => ({ ...item, type: 'deck', desc: `${item._count.flashcards} cards` })))
      );
    }

    const allItemsArrays = await Promise.all(promises);
    const allItemsMap = new Map(allItemsArrays.flat().map(item => [item.id, item]));

    // 5. Combine links with details
    const contentDetails: ProjectContentDetails = {
      links: links.map(link => {
        const details = allItemsMap.get(link.content_id);
        return {
          id: link.id,
          content_id: link.content_id,
          content_type: link.content_type,
          created_at: link.created_at?.toISOString() || '',
          title: details?.title || 'Unknown Item',
          description: details?.desc || null,
          icon: link.content_type, // 'document', 'quiz', 'note', 'deck'
        };
      }),
    };
    
    const finalProject: Project = {
        ...project,
        description: project.description || null,
        created_at: project.created_at?.toISOString() || '',
        updated_at: project.updated_at?.toISOString() || '',
    };

    return { project: finalProject, contentDetails };

  } catch (error) {
    console.error(`Error fetching project data for ${projectId}:`, error);
    return null;
  }
}

export default async function ProjectDetailPage({ params }: { params: { projectId: string } }) {
  const session = await getServerSession();
  if (!session?.user) {
    redirect('/login');
  }

  const data = await getProjectData(params.projectId, session.user.id);

  if (!data) {
    redirect('/projects');
  }

  return (
    <Suspense fallback={<ProjectDetailLoading />}>
      <ProjectClientComponent initialProject={data.project} initialContent={data.contentDetails} />
    </Suspense>
  );
}

// Separate loading component
function ProjectDetailLoading() {
  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-10 w-36" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>
      </div>
      <div className="mb-8">
        <Skeleton className="h-9 w-1/2 rounded" />
        <Skeleton className="h-4 w-3/4 rounded mt-3" />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex-row items-center gap-4 space-y-0">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-5 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6 mt-2" />
            </CardContent>
            <CardFooter className="justify-end gap-2">
              <Skeleton className="h-9 w-9" />
              <Skeleton className="h-9 w-20" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </>
  );
}