import { notFound, redirect } from 'next/navigation';
import { getServerSession } from '@/lib/getServerSession';
import { prisma } from '@/lib/prisma';
import { ProjectClientComponent } from './ProjectClientComponent';

interface ProjectPageProps {
  params: {
    projectId: string;
  };
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const session = await getServerSession();
  if (!session?.user) redirect('/login');

  // 1. Fetch Project with all its links
  const project = await prisma.projects.findUnique({
    where: { 
      id: params.projectId,
      user_id: session.user.id 
    },
    include: {
      links: true, // We need the links table to know what is in this project
    }
  });

  if (!project) return notFound();

  // 2. Fetch the actual content items efficiently
  //    We grab all IDs first, then fetch them in parallel batches
  const contentIds = project.links.map(l => l.content_id);
  
  const [documents, recordings, notes, quizzes] = await Promise.all([
    prisma.documents.findMany({ where: { id: { in: contentIds } } }),
    prisma.recordings.findMany({ where: { id: { in: contentIds } } }),
    prisma.notes.findMany({ where: { id: { in: contentIds } } }),
    prisma.quiz.findMany({ where: { id: { in: contentIds } } }),
  ]);

  // 3. Merge the "Link" data with the "Content" data
  //    This creates the unified list expected by ProjectClientComponent
  const unifiedLinks = project.links.map(link => {
    let details: any = {};
    
    // Find the specific item details based on type
    if (link.content_type === 'document') {
      details = documents.find(d => d.id === link.content_id) || {};
    } else if (link.content_type === 'recording') {
      details = recordings.find(r => r.id === link.content_id) || {};
    } else if (link.content_type === 'note') {
      details = notes.find(n => n.id === link.content_id) || {};
    } else if (link.content_type === 'quiz') {
      details = quizzes.find(q => q.id === link.content_id) || {};
    }

    // Return the combined shape
    return {
      id: link.id,               // The Link ID (crucial for removing items from project)
      content_id: link.content_id,
      content_type: link.content_type,
      // Fallback titles/descriptions if data is missing
      title: details.title || details.file_name || details.topic || 'Untitled',
      description: details.description || details.summary || '',
      icon: link.content_type,
      created_at: link.created_at.toISOString(),
      ...details // Spread the rest of the specific details (like storage_path, etc.)
    };
  }).filter(item => item.title !== 'Untitled'); // Optional: Filter out broken links

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden">
      <ProjectClientComponent 
        initialProject={project} 
        initialContent={{ links: unifiedLinks }} 
      />
    </div>
  );
}