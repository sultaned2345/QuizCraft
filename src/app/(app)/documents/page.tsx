import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { DocumentsClientComponent } from './DocumentsClientComponent'; // Import client component
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/getServerSession'; // Ensure this helper exists
import { USAGE_LIMITS } from '@/lib/usage-limits'; // Or use DB constant
const FREE_DOCUMENT_LIMIT = 5; // Keep consistent

// Types (keep as defined before)
interface DocumentMetadata { id: string; file_name: string; file_type: string; file_size: number; created_at: string; storage_path: string; }
interface PaginatedDocumentsData { documents: DocumentMetadata[]; count: number; limit: number | typeof Infinity; totalPages: number; currentPage: number; }

// --- Server-Side Data Fetching Function ---
async function getInitialDocuments(userId: string, page: number = 1, limit: number = 9): Promise<PaginatedDocumentsData> {
    const skip = (page - 1) * limit;
    try {
        const userProfile = await prisma.profiles.findUnique({
            where: { id: userId },
            select: { subscription_plan: true },
        });
        const plan = userProfile?.subscription_plan === 'pro' ? 'pro' : 'free';
        const usageLimit = plan === 'pro' ? Infinity : FREE_DOCUMENT_LIMIT;

        const [documentsData, totalCount] = await prisma.$transaction([
            prisma.documents.findMany({
                where: { user_id: userId },
                select: { id: true, file_name: true, file_type: true, file_size: true, created_at: true, storage_path: true },
                orderBy: { created_at: 'desc' },
                take: limit,
                skip: skip,
            }),
            prisma.documents.count({
                where: { user_id: userId },
            }),
        ]);

        // Serialize dates
        const documents: DocumentMetadata[] = documentsData.map(doc => ({
            ...doc,
            created_at: doc.created_at?.toISOString() || '',
        }));

        const totalPages = Math.ceil(totalCount / limit);

        return {
            documents,
            count: totalCount,
            limit: usageLimit,
            totalPages,
            currentPage: page,
        };
    } catch (error) {
        console.error("Error fetching initial documents:", error);
        return {
            documents: [], count: 0, limit: FREE_DOCUMENT_LIMIT, totalPages: 0, currentPage: 1,
        };
    }
}


// --- The Page Component (Server Component) ---
export default async function DocumentsPage() {
    const session = await getServerSession();

    if (!session?.user) {
         return <div>Please log in.</div>; // Placeholder
    }

    // Fetch initial data on the server
    const initialDocumentsData = await getInitialDocuments(session.user.id, 1, 9);

    return (
        <Suspense fallback={<div className="flex h-[calc(100vh-8rem)] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin"/></div>}>
            {/* Render the Client Component */}
            <DocumentsClientComponent initialData={initialDocumentsData} />
        </Suspense>
    );
}