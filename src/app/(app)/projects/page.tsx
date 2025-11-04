// src/app/(app)/projects/page.tsx
// NEW FILE

import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { ProjectsClientComponent } from './ProjectsClientComponent'; // Import client component
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession';
import { Project } from '@/types/database';

export const dynamic = 'force-dynamic';

async function getInitialProjects(userId: string): Promise<Project[]> {
  try {
    const projects = await prisma.projects.findMany({
      where: { user_id: userId },
      include: {
        _count: {
          select: { links: true },
        },
      },
      orderBy: { updated_at: 'desc' },
      take: 20, // Load first 20 projects
    });

    // Serialize data for the client
    return projects.map(p => ({
      ...p,
      description: p.description || null,
      created_at: p.created_at?.toISOString() || '',
      updated_at: p.updated_at?.toISOString() || '',
    }));
  } catch (error) {
    console.error("Error fetching initial projects:", error);
    return [];
  }
}

export default async function ProjectsPage() {
  const session = await getServerSession();
  if (!session?.user) {
    // This should be handled by the layout, but as a safeguard:
    return <div>Please log in.</div>;
  }

  const initialProjects = await getInitialProjects(session.user.id);

  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <ProjectsClientComponent initialData={initialProjects} />
    </Suspense>
  );
}