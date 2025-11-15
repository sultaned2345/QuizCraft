// src/app/(app)/projects/page.tsx
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { getServerSession } from '@/lib/getServerSession';
// --- 1. CHANGE THIS IMPORT ---
import { ProjectsClientComponent } from './ProjectsClientComponent';
// --- END CHANGE ---
import type { Database } from '@/types/database';

type Project = Database['public']['Tables']['projects']['Row'];

async function getProjects(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching projects:', error);
    return [];
  }
  return data;
}

export default async function ProjectsPage() {
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  const projects = await getProjects(session.user.id);

  return <ProjectsClientComponent initialProjects={projects} />;
}