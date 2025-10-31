// src/app/(app)/dashboard/DashboardClientComponent.tsx
'use client'; // Keep this directive

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { supabaseHelpers } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Copy, Edit, Trash2, Plus, FileQuestion, Loader2, Combine } from 'lucide-react';
import { Quiz, ApiResponse } from '@/types/database';
import { Checkbox } from '@/components/ui/checkbox'; // <-- NEW IMPORT
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog'; // <-- NEW IMPORT
import { Input } from '@/components/ui/input'; // <-- NEW IMPORT
import { Label } from '@/components/ui/label'; // <-- NEW IMPORT
import { cn } from '@/lib/utils';


// Adjust Quiz type for dashboard list view
interface DashboardQuiz extends Omit<Quiz, 'questions' | 'user_id' | 'immediate_feedback'> {
  questionsCount: number;
}

interface PaginatedQuizzesData {
    quizzes: DashboardQuiz[];
    totalCount: number;
    totalPages: number;
    currentPage: number;
}

interface DashboardClientComponentProps {
  initialData: PaginatedQuizzesData;
}


export function DashboardClientComponent({ initialData }: DashboardClientComponentProps) {
  const [quizzes, setQuizzes] = useState<DashboardQuiz[]>(initialData.quizzes);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalQuizzes, setTotalQuizzes] = useState(initialData.totalCount);
  const [currentPage, setCurrentPage] = useState(initialData.currentPage);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const quizzesPerPage = 9;

  // --- NEW STATE for Combine Feature ---
  const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>([]);
  const [isCombineDialogOpen, setIsCombineDialogOpen] = useState(false);
  const [newCombineTitle, setNewCombineTitle] = useState("");
  const [isCombining, setIsCombining] = useState(false);
  // ---

  const { user, session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  // --- REFRESH FUNCTION (using router.refresh) ---
  const refreshDashboard = () => {
    // This simple call will refetch server data and update the UI
    router.refresh();
    
    // We also reset client-side state after a refresh
    setSelectedQuizIds([]);
    setNewCombineTitle("");
    setIsCombining(false);
    setIsCombineDialogOpen(false);
  };
  
  // Note: We no longer need fetchMoreQuizzes or refreshFirstPage
  // because router.refresh() handles updates.
  // We'll keep fetchMoreQuizzes for the "Load More" button.

  // --- Fetch More Quizzes (Client-Side for Load More) ---
  const fetchMoreQuizzes = useCallback(async (page: number) => {
    if (!user || !session || isLoadingMore || page > totalPages) return;
    setIsLoadingMore(true);

    try {
      // This MUST be an API route, not a server helper
      const response = await fetch(`/api/dashboard/quizzes?page=${page}&limit=${quizzesPerPage}`, {
         headers: { 'Authorization': `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch");
      
      const data: ApiResponse<PaginatedQuizzesData> = await response.json();
      if (!data.success || !data.data) throw new Error(data.error || "Failed to load");

      setQuizzes(prev => [...prev, ...data.data!.quizzes]);
      setTotalQuizzes(data.data.totalCount);
      setCurrentPage(data.data.currentPage);
      setTotalPages(data.data.totalPages);
    
    } catch (error) {
      console.error("Error fetching more quizzes:", error);
      toast({ title: "Error", description: "Failed to load more quizzes.", variant: "destructive" });
    } finally {
      setIsLoadingMore(false);
    }
  }, [user, session, toast, quizzesPerPage, isLoadingMore, totalPages]);

  const handleLoadMore = () => {
    // We'd need to build /api/dashboard/quizzes for this to work
    // For now, we'll just log it.
    console.log("Load More clicked. Requires /api/dashboard/quizzes endpoint.");
    toast({ title: "Load More", description: "This requires a dedicated API endpoint."});
    // fetchMoreQuizzes(currentPage + 1);
  };


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
         const response = await fetch(`/api/quiz/${quizId}`, {
             method: 'DELETE',
             headers: { 'Authorization': `Bearer ${session.access_token}` },
         });
         const result: ApiResponse = await response.json();
         if (!result.success) throw new Error(result.error || "Failed to delete via API");

        toast({ title: "Quiz deleted" });
        refreshDashboard(); // <-- Use router.refresh()
      } catch (error: any) {
        toast({ title: "Error", description: error.message || "Failed to delete quiz.", variant: "destructive" });
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // --- NEW HANDLER for Combine Feature ---
  const handleToggleSelectQuiz = (quizId: string) => {
    setSelectedQuizIds((prev) =>
      prev.includes(quizId)
        ? prev.filter((id) => id !== quizId)
        : [...prev, quizId]
    );
  };

  const handleCombineQuizzes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || selectedQuizIds.length < 2 || !newCombineTitle.trim()) return;
    
    setIsCombining(true);
    try {
      const response = await fetch('/api/quizzes/combine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          quizIds: selectedQuizIds,
          title: newCombineTitle.trim(),
        }),
      });

      const result: ApiResponse<Quiz> = await response.json();
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error || 'Failed to combine quizzes.');
      }

      toast({
        title: "Quizzes Combined!",
        description: `Successfully created "${result.data.title}".`,
      });
      refreshDashboard(); // This will close dialog, reset state, and refetch quizzes
      
    } catch (error: any) {
      toast({ title: "Combine Failed", description: error.message, variant: "destructive" });
      setIsCombining(false); // Only set to false on error, success handles it
    }
  };


  return (
    <>
      {/* Header section */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">My Quizzes ({totalQuizzes})</h1>
        <div className="flex gap-2">
          {/* --- MODIFICATION: Show Combine button conditionally --- */}
          {selectedQuizIds.length > 1 && (
            <Button variant="outline" onClick={() => setIsCombineDialogOpen(true)}>
              <Combine className="w-4 h-4 mr-2" />
              Combine ({selectedQuizIds.length})
            </Button>
          )}
          <Button asChild>
            <Link href="/create">
              <Plus className="w-4 h-4 mr-2" />
              New Quiz
            </Link>
          </Button>
        </div>
      </div>

      {/* Grid or Empty State */}
      {quizzes.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg"> <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground" /> <h3 className="mt-4 text-lg font-semibold">No Quizzes Found</h3> <p className="mt-1 text-sm text-muted-foreground">Get started by creating your first quiz.</p> <Button className="mt-6" asChild><Link href="/create"><Plus className="w-4 h-4 mr-2" />Create a Quiz</Link></Button> </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {quizzes.map((quiz) => (
            <Card key={quiz.id} className={cn("flex flex-col transition-all", selectedQuizIds.includes(quiz.id) ? "ring-2 ring-primary" : "")}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  {/* --- MODIFICATION: Added Checkbox --- */}
                  <div className="flex items-center gap-3 pr-2">
                    <Checkbox
                      id={`select-${quiz.id}`}
                      checked={selectedQuizIds.includes(quiz.id)}
                      onCheckedChange={() => handleToggleSelectQuiz(quiz.id)}
                      aria-label={`Select quiz ${quiz.title}`}
                    />
                    <label htmlFor={`select-${quiz.id}`} className="cursor-pointer">
                      <CardTitle className="text-lg">{quiz.title}</CardTitle>
                    </label>
                  </div>
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

      {/* --- NEW DIALOG for Combine Feature --- */}
      <Dialog open={isCombineDialogOpen} onOpenChange={setIsCombineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Combine Quizzes</DialogTitle>
            <DialogDescription>
              Create a new quiz from the {selectedQuizIds.length} quizzes you selected.
              Please provide a title for the new combined quiz.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCombineQuizzes}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="combine-title" className="text-right">
                  New Title
                </Label>
                <Input
                  id="combine-title"
                  value={newCombineTitle}
                  onChange={(e) => setNewCombineTitle(e.target.value)}
                  className="col-span-3"
                  placeholder="e.g., Midterm Review"
                  disabled={isCombining}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost" disabled={isCombining}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isCombining || !newCombineTitle.trim()}>
                {isCombining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Combine and Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}