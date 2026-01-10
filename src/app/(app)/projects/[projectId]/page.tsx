import { notFound, redirect } from 'next/navigation';
import { getServerSession } from '@/lib/getServerSession';
import { prisma } from '@/lib/prisma';
import { ProjectWorkspace } from './ProjectClientComponent';

interface ProjectPageProps {
  params: {
    projectId: string;
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const session = await getServerSession();
  if (!session?.user) redirect('/login');

  // 1. Fetch Project with all relations
  const project = await prisma.projects.findUnique({
    where: { 
      id: params.projectId,
      user_id: session.user.id 
    },
    include: {
      // Get all linked items (Documents, Notes, Quizzes, Recordings)
      links: {
        include: {
          // Unfortunately, Prisma doesn't auto-fetch the polymorphic relation content 
          // easily in one go. We will handle the "content" mapping below or 
          // fetch specific types separately.
        }
      },
      // We can also fetch known relations directly if defined in schema
      // (Using the glue table is cleaner for order, but direct fetch is easier for MVP)
    }
  });

  if (!project) return notFound();

  // 2. Fetch the actual content items belonging to this project
  //    (We do this separately to get the strongly typed objects)
  
  // A. Documents (PDFs)
  const documents = await prisma.documents.findMany({
    where: { 
      // Link via join table OR direct project_id if you added it (our schema uses link table)
      // Let's use the link table to find document IDs
      id: { in: (await prisma.project_content_links.findMany({
        where: { project_id: project.id, content_type: 'document' },
        select: { content_id: true }
      })).map(l => l.content_id) }
    }
  });

  // B. Recordings (Audio)
  const recordings = await prisma.recordings.findMany({
    where: { 
      id: { in: (await prisma.project_content_links.findMany({
        where: { project_id: project.id, content_type: 'recording' },
        select: { content_id: true }
      })).map(l => l.content_id) }
    }
  });

  // C. Notes (Summaries)
  const notes = await prisma.notes.findMany({
    where: { 
      id: { in: (await prisma.project_content_links.findMany({
        where: { project_id: project.id, content_type: 'note' },
        select: { content_id: true }
      })).map(l => l.content_id) }
    },
    orderBy: { created_at: 'desc' }
  });

  // D. Quizzes
  const quizzes = await prisma.quiz.findMany({
    where: { 
      id: { in: (await prisma.project_content_links.findMany({
        where: { project_id: project.id, content_type: 'quiz' },
        select: { content_id: true }
      })).map(l => l.content_id) }
    }
  });

  // 3. Determine Initial State
  // Combine Docs and Recordings into a single "Sources" list
  const sources = [
    ...documents.map(d => ({ ...d, type: 'document' as const })),
    ...recordings.map(r => ({ ...r, type: 'recording' as const, file_name: r.title, storage_path: null })) // Recordings might not have a PDF path
  ];

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden">
      <ProjectWorkspace 
        project={project} 
        initialSources={sources}
        initialNotes={notes}
        initialQuizzes={quizzes}
        userId={session.user.id}
      />
    </div>
  );
}