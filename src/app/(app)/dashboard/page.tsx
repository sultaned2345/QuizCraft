import { Suspense } from 'react';
import { getServerSession } from '@/lib/getServerSession';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { Skeleton } from "@/components/ui/skeleton";
import { WelcomeHero } from '@/components/dashboard/WelcomeHero';

// Fetch projects server-side
async function getProjects(userId: string) {
  return await prisma.projects.findMany({
    where: { user_id: userId },
    orderBy: { updated_at: 'desc' },
    include: {
      _count: {
        select: { links: true } // Count how many items are in the project
      }
    }
  });
}

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session?.user) redirect('/login');

  const projects = await getProjects(session.user.id);

  return (
    <div className="space-y-8 pb-10">
      {/* 1. Hero Section: "What are we learning today?" */}
      <WelcomeHero userName={session.user.user_metadata?.full_name || 'Student'} />

      {/* 2. Projects Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">My Projects</h2>
          <CreateProjectDialog />
        </div>

        {projects.length === 0 ? (
          // Empty State
          <div className="border-2 border-dashed rounded-xl p-10 text-center space-y-4 bg-muted/10">
            <div className="text-muted-foreground">
              You haven't created any projects yet.
            </div>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Projects act as folders for your PDFs, notes, and quizzes. 
              Upload a file to get started.
            </p>
          </div>
        ) : (
          // Grid State
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </div>

      {/* 3. Quick Stats (Preserving some "Smart" features) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {/* Placeholder for future analytics widgets */}
      </div>
    </div>
  );
}