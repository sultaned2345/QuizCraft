import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { NotesClientComponent } from './NotesClientComponent'; // Import the new client component
import { prisma } from '@/lib/prisma'; // Import prisma directly
import { getServerSession } from '@/lib/getServerSession'; // Helper to get session on server
import { USAGE_LIMITS } from '@/lib/usage-limits';
import { Note } from '@/types/database'; // Import Note type if needed for casting

// Define expected response structure for pagination
interface PaginatedNotesData {
  notes: NoteListItem[]; // Use the leaner type
  count: number;
  limit: number | typeof Infinity;
  totalPages: number;
  currentPage: number;
}
// --- Type for the simplified Note structure for the list ---
interface NoteListItem {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  // content is excluded
}


// --- Server-Side Data Fetching Function ---
async function getInitialNotes(userId: string, page: number = 1, limit: number = 9): Promise<PaginatedNotesData> {
    const skip = (page - 1) * limit;

    try {
         // Fetch user's subscription plan using Prisma
        const userProfile = await prisma.profiles.findUnique({
            where: { id: userId },
            select: { subscription_plan: true },
        });
        const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
        const usageLimit = plan === 'pro' ? Infinity : USAGE_LIMITS.FREE_NOTES;

        // Fetch initial notes and total count
        const [notesData, totalCount] = await prisma.$transaction([
            prisma.notes.findMany({
                where: { user_id: userId },
                orderBy: { created_at: 'desc' },
                take: limit,
                skip: skip,
                select: { // Select only necessary fields
                    id: true,
                    user_id: true,
                    title: true,
                    created_at: true,
                    updated_at: true,
                }
            }),
            prisma.notes.count({
                where: { user_id: userId },
            }),
        ]);

        // Serialize dates
        const notes: NoteListItem[] = notesData.map(note => ({
            ...note,
            created_at: note.created_at?.toISOString() || '',
            updated_at: note.updated_at?.toISOString() || '',
        }));

        const totalPages = Math.ceil(totalCount / limit);

        return {
            notes,
            count: totalCount,
            limit: usageLimit,
            totalPages,
            currentPage: page,
        };
    } catch (error) {
        console.error("Error fetching initial notes:", error);
        // Return default/empty state on error
        return {
            notes: [],
            count: 0,
            limit: USAGE_LIMITS.FREE_NOTES, // Default to free limit
            totalPages: 0,
            currentPage: 1,
        };
    }
}


// --- The Page Component (Now a Server Component) ---
export default async function NotesPage() {
    // --- Get User Session on the Server ---
    // You'll need a helper function to get the session/user on the server.
    // This depends on how you handle auth server-side (e.g., cookies, Supabase helpers)
    // Example using a hypothetical getServerSession helper:
    const session = await getServerSession(); // Implement this helper based on your auth setup

    if (!session?.user) {
        // Redirect logic if using App Router redirects
        // redirect('/login');
        // Or handle appropriately if using middleware
         return <div>Please log in.</div>; // Placeholder
    }

    // Fetch initial data on the server
    const initialNotesData = await getInitialNotes(session.user.id, 1, 9); // Fetch page 1, 9 items

    return (
        // Suspense is good practice for RSCs, though maybe not strictly needed here
        <Suspense fallback={<div className="flex h-[calc(100vh-8rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
            {/* Render the Client Component and pass initial data */}
            <NotesClientComponent initialData={initialNotesData} />
        </Suspense>
    );
}

// --- IMPORTANT: getServerSession Helper ---
// You need to create `src/lib/getServerSession.ts` (or similar)
// Its implementation depends heavily on your auth setup (e.g., Supabase with cookies)
// Example using Supabase cookie helper (INSTALL @supabase/ssr):
/*
// src/lib/getServerSession.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getServerSession() {
  const cookieStore = cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const { data: { session } } = await supabase.auth.getSession()
  return session
}
*/