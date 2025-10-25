'use client'; // Keep this directive

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseHelpers } from '@/lib/supabase'; // Keep for deleteQuiz for now
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Copy, Edit, Trash2, Plus, FileQuestion, Loader2 } from 'lucide-react';
import { Quiz, ApiResponse } from '@/types/database'; // Base Quiz type

// Adjust Quiz type for dashboard list view
interface DashboardQuiz extends Omit<Quiz, 'questions' | 'user_id' | 'immediate_feedback'> { // Omit unused fields
  questionsCount: number;
}

// Define expected response structure for pagination API calls (if needed for Load More)
// Or reuse the Paginated type if you create one
interface PaginatedQuizzesData {
    quizzes: DashboardQuiz[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
}

// Define props for the client component, including initial data
interface DashboardClientComponentProps {
  initialData: PaginatedQuizzesData;
}


export function DashboardClientComponent({ initialData }: DashboardClientComponentProps) {
  // Initialize state with data passed from the Server Component
  const [quizzes, setQuizzes] = useState<DashboardQuiz[]>(initialData.quizzes);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalQuizzes, setTotalQuizzes] = useState(initialData.totalCount);
  const [currentPage, setCurrentPage] = useState(initialData.currentPage);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const quizzesPerPage = 9; // Should match server fetch limit

  // Removed isLoading state, handled by Suspense in parent
  // Removed authLoading check, handled by parent

  const { user, session } = useAuth(); // Get session for client-side actions
  const router = useRouter();
  const { toast } = useToast();

  // --- Fetch More Quizzes (Client-Side for Load More) ---
  const fetchMoreQuizzes = useCallback(async (page: number) => {
    if (!user || !session || isLoadingMore || page > totalPages) return;
    setIsLoadingMore(true);

    try {
      // You might need a dedicated API route for subsequent page loads,
      // or adapt the server-side helper if it can be called client-side (less common).
      // Assuming an API route `/api/dashboard/quizzes?page=X&limit=Y` exists
      // For now, we'll simulate fetching from the existing helper structure,
      // but ideally, this would hit an API route.
      // *** THIS PART NEEDS ADJUSTMENT IF YOU WANT CLIENT-SIDE LOAD MORE ***
      // *** Currently using the server helper directly won't work client-side ***
      /*
      const { quizzes: quizzesData, totalCount } = await supabaseHelpers.getQuizzesForDashboard(user.id, page, quizzesPerPage);

      setQuizzes(prev => [...prev, ...quizzesData]);
      setTotalQuizzes(totalCount); // Might already be up-to-date
      setCurrentPage(page);
      setTotalPages(Math.ceil(totalCount / quizzesPerPage));
      */
     // Placeholder: Implement client-side API call if Load More is needed
     console.warn("Load More button clicked, but client-side fetching needs API endpoint.");
     toast({ title: "Load More not fully implemented", description:"Requires client-side API call."});


    } catch (error) {
      console.error("Error fetching more quizzes:", error);
      toast({ title: "Error", description: "Failed to load more quizzes.", variant: "destructive" });
    } finally {
      setIsLoadingMore(false);
    }
  }, [user, session, toast, quizzesPerPage, isLoadingMore, totalPages]);

   // --- Refresh Function (Refetch Page 1 Client-Side) ---
    const refreshFirstPage = useCallback(async () => {
        if (!user || !session) return;
        // Indicate loading if needed
        try {
             // *** NEEDS ADJUSTMENT: Call API route instead of server helper ***
             /*
            const { quizzes: quizzesData, totalCount } = await supabaseHelpers.getQuizzesForDashboard(user.id, 1, quizzesPerPage);
            setQuizzes(quizzesData);
            setTotalQuizzes(totalCount);
            setCurrentPage(1);
            setTotalPages(Math.ceil(totalCount / quizzesPerPage));
            */
           // Placeholder:
           console.warn("refreshFirstPage needs client-side API call.");
           toast({ title: "Refresh not fully implemented", description:"Requires client-side API call."});

        } catch (error: any) {
            toast({ title: "Error Refreshing Quizzes", description: error.message, variant: "destructive" });
        } finally {
            // Stop loading indicator
        }
    }, [user, session, toast, quizzesPerPage]);


  const handleLoadMore = () => {
    fetchMoreQuizzes(currentPage + 1);
  }


  // --- Other handlers (Copy, Delete - use refreshFirstPage) ---
  const handleCopyShareLink = (shareLink: string | null) => {
    if (!shareLink) { /* ... */ return; };
    const shareUrl = `${window.location.origin}/quiz/${shareLink}`;
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Link copied!", description: "Share link copied." });
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!session) { toast({ title: "Error", description: "Not authenticated.", variant: "destructive" }); return; }
    if (confirm("Delete this quiz permanently?")) {
      try {
        // OPTION 1: Keep using Supabase helper (if RLS allows client deletion) - Simpler
        // await supabaseHelpers.deleteQuiz(quizId);

        // OPTION 2: Call a dedicated DELETE API route (Recommended)
         const response = await fetch(`/api/quiz/${quizId}`, { // Assuming you create this API route
             method: 'DELETE',
             headers: { 'Authorization': `Bearer ${session.access_token}` },
         });
         const result: ApiResponse = await response.json();
         if (!result.success) throw new Error(result.error || "Failed to delete via API");


        toast({ title: "Quiz deleted" });
        refreshFirstPage(); // Use client-side refresh
      } catch (error: any) {
        toast({ title: "Error", description: error.message || "Failed to delete quiz.", variant: "destructive" });
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // --- Render Logic ---
  // (No top-level loading check needed)

  return (
    <>
      {/* Header section */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">My Quizzes ({totalQuizzes})</h1>
        <Button asChild><Link href="/create"><Plus className="w-4 h-4 mr-2" />New Quiz</Link></Button>
      </div>

      {/* Grid or Empty State */}
      {quizzes.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg"> <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground" /> <h3 className="mt-4 text-lg font-semibold">No Quizzes Found</h3> <p className="mt-1 text-sm text-muted-foreground">Get started by creating your first quiz.</p> <Button className="mt-6" asChild><Link href="/create"><Plus className="w-4 h-4 mr-2" />Create a Quiz</Link></Button> </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className="flex flex-col">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg pr-2">{quiz.title}</CardTitle>
                  {/* Dropdown Menu */}
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/quiz/${quiz.id}`)}><FileQuestion className="w-4 h-4 mr-2" />View Quiz</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/quiz/${quiz.id}/edit`)}><Edit className="w-4 h-4 mr-2" />Edit Quiz</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCopyShareLink(quiz.share_link)}><Copy className="w-4 h-4 mr-2" />Copy Link</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteQuiz(quiz.id)} className="text-destructive"><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="flex items-center text-sm text-muted-foreground gap-2">
                  <FileQuestion className="w-4 h-4" />
                  <span>{quiz.questionsCount} Questions</span>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between items-center text-sm">
                <Badge variant={quiz.is_public ? "default" : "secondary"}>{quiz.is_public ? "Public" : "Draft"}</Badge>
                <span className="text-muted-foreground">{formatDate(quiz.created_at)}</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

       {/* Load More Button */}
      {totalPages > currentPage && (
          <div className="mt-8 text-center">
              <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
                  {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More Quizzes
              </Button>
               <p className="text-xs text-muted-foreground mt-2">Showing {quizzes.length} of {totalQuizzes} quizzes</p>
          </div>
      )}
    </>
  );
}