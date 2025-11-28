// src/app/(app)/quizzes/QuizzesClientComponent.tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MoreHorizontal, Copy, Edit, Trash2, Plus, FileQuestion, Loader2, Combine, Play, RefreshCw, Calendar } from 'lucide-react';
import { Quiz, QuizAttempt, ApiResponse } from '@/types/database';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { QuizPerformanceChart } from '@/components/dashboard/QuizPerformanceChart';
import { motion } from 'framer-motion';
import { PersonalizedStudyPlan } from '@/components/dashboard/PersonalizedStudyPlan';

interface DashboardQuiz extends Omit<Quiz, 'questions' | 'user_id' | 'immediate_feedback'> {
  questionsCount: number;
}
interface DashboardData {
  quizzes: DashboardQuiz[];
  totalQuizCount: number;
  quizzesTotalPages: number;
  quizzesCurrentPage: number;
  dueCardCount: number;
  recentAttempts: QuizAttempt[];
}
interface QuizzesClientComponentProps {
  initialData: DashboardData;
}

export function QuizzesClientComponent({ initialData }: QuizzesClientComponentProps) { 
  const [quizzes, setQuizzes] = useState<DashboardQuiz[]>(initialData.quizzes);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalQuizzes, setTotalQuizzes] = useState(initialData.totalQuizCount);
  const [currentPage, setCurrentPage] = useState(initialData.quizzesCurrentPage);
  const [totalPages, setTotalPages] = useState(initialData.quizzesTotalPages);
  const quizzesPerPage = 9;
  const [recentAttempts, setRecentAttempts] = useState(initialData.recentAttempts);
  const [selectedQuizIds, setSelectedQuizIds] = useState<string[]>([]);
  const [isCombineDialogOpen, setIsCombineDialogOpen] = useState(false);
  const [newCombineTitle, setNewCombineTitle] = useState('');
  const [isCombining, setIsCombining] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { user, session } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { type: 'spring', stiffness: 100 }
    },
  };

  const refreshDashboard = () => {
    router.refresh();
    setSelectedQuizIds([]);
    setNewCombineTitle("");
    setIsCombining(false);
    setIsCombineDialogOpen(false);
    setIsDeleting(false);
  };

  const fetchMoreQuizzes = useCallback(async (page: number) => {
    toast({ title: "Load More", description: "This requires a dedicated API endpoint." });
  }, [toast]);

  const handleLoadMore = () => {
    console.log("Load More clicked. Requires /api/quizzes endpoint.");
    toast({ title: "Load More", description: "This requires a dedicated API endpoint." });
  };

  const handleCopyShareLink = (shareLink: string | null) => {
    if (!shareLink) { 
      toast({ title: "No share link", description: "This quiz is not public.", variant: "destructive" }); 
      return; 
    }
    const shareUrl = `${window.location.origin}/quiz/${shareLink}`;
    navigator.clipboard.writeText(shareUrl);
    toast({ title: "Link copied!", description: "Share link copied." });
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!session) { 
      toast({ title: "Error", description: "Not authenticated.", variant: "destructive" }); 
      return; 
    }
    const quizToDelete = quizzes.find(q => q.id === quizId);
    if (!quizToDelete) return;
    const originalQuizzes = [...quizzes];
    setQuizzes(prevQuizzes => prevQuizzes.filter(q => q.id !== quizId));
    setTotalQuizzes(prev => prev - 1);
    setIsDeleting(true); 

    try {
        const response = await fetch(`/api/quiz/${quizId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        const result: ApiResponse = await response.json();
        if (!result.success) {
          throw new Error(result.error || "Failed to delete via API");
        }
        toast({ title: "Quiz deleted", description: `"${quizToDelete.title}" was removed.` });
        if (selectedQuizIds.includes(quizId)) {
          setSelectedQuizIds(prev => prev.filter(id => id !== quizId));
        }
    } catch (error: any) {
      toast({ title: "Delete Failed", description: error.message || "Failed to delete quiz.", variant: "destructive" });
      setQuizzes(originalQuizzes); 
      setTotalQuizzes(prev => prev + 1);
    } finally {
      setIsDeleting(false); 
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

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
      refreshDashboard();
    } catch (error: any) {
      toast({ title: "Combine Failed", description: error.message, variant: "destructive" });
      setIsCombining(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-1">
          <PersonalizedStudyPlan />
        </div>
        <div className="md:col-span-2">
          <QuizPerformanceChart attempts={recentAttempts} />
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">My Quizzes ({totalQuizzes})</h1>
        <div className="flex gap-2">
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

      {quizzes.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-lg">
          <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-semibold">No Quizzes Found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by creating your first quiz.
          </p>
          <Button className="mt-6" asChild>
            <Link href="/create">
              <Plus className="w-4 h-4 mr-2" />
              Create a Quiz
            </Link>
          </Button>
        </div>
      ) : (
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {quizzes.map((quiz) => {
            const hasAttempted = recentAttempts.some(a => a.quiz_id === quiz.id);

            return (
              <motion.div key={quiz.id} variants={itemVariants}>
                <Card
                  className={cn(
                    'flex flex-col h-full transition-all duration-200 hover:shadow-lg hover:border-primary/50 group bg-card',
                    selectedQuizIds.includes(quiz.id) ? 'ring-2 ring-primary border-primary' : ''
                  )}
                >
                  <CardHeader className="relative pb-2">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                      <FileQuestion className="w-16 h-16 text-primary rotate-12" />
                    </div>

                    <div className="flex justify-between items-start z-10">
                      <div className="flex items-start gap-3 pr-2 w-full">
                        <Checkbox
                          id={`select-${quiz.id}`}
                          checked={selectedQuizIds.includes(quiz.id)}
                          onCheckedChange={() => handleToggleSelectQuiz(quiz.id)}
                          className="mt-1"
                          aria-label={`Select quiz ${quiz.title}`}
                        />
                        <div className="space-y-1.5 w-full">
                           <div className="flex items-center justify-between w-full">
                             <Badge variant={quiz.is_public ? 'default' : 'secondary'} className="text-[10px] h-5 px-1.5 font-normal">
                                {quiz.is_public ? 'Public' : 'Draft'}
                             </Badge>
                             <AlertDialog>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 -mr-2 text-muted-foreground hover:text-foreground">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </DropdownMenuTrigger>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => router.push(`/quiz/${quiz.id}/edit`)}>
                                      <Edit className="w-4 h-4 mr-2" />
                                      Edit Quiz
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleCopyShareLink(quiz.share_link)}>
                                      <Copy className="w-4 h-4 mr-2" />
                                      Copy Link
                                    </DropdownMenuItem>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem
                                        className="text-destructive"
                                        onSelect={(e) => e.preventDefault()}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete the quiz titled:
                                      <br />
                                      <strong className="py-2 inline-block">{quiz.title}</strong>
                                      <br />
                                      This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className={cn(buttonVariants({ variant: 'destructive' }))}
                                      disabled={isDeleting}
                                      onClick={() => handleDeleteQuiz(quiz.id)}
                                    >
                                      {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                           </div>
                           <label htmlFor={`select-${quiz.id}`} className="cursor-pointer block">
                              <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors line-clamp-2">
                                {quiz.title}
                              </CardTitle>
                           </label>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="flex-grow z-10 pt-2 pb-4">
                     <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
                          <FileQuestion className="w-3.5 h-3.5" />
                          <span className="font-medium">{quiz.questionsCount}</span>
                          <span className="text-xs opacity-70">Questions</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs opacity-80">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{formatDate(quiz.created_at)}</span>
                        </div>
                     </div>
                  </CardContent>

                  <CardFooter className="pt-0 z-10">
                    <Button asChild size="default" className={cn("w-full transition-all", hasAttempted ? "bg-secondary text-secondary-foreground hover:bg-secondary/80" : "")}>
                      <Link href={`/quiz/${quiz.id}`}>
                        {hasAttempted ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Retake Quiz
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Start Quiz
                          </>
                        )}
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      {totalPages > currentPage && (
        <div className="mt-8 text-center">
          <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
            {isLoadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Load More Quizzes
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Showing {quizzes.length} of {totalQuizzes} quizzes
          </p>
        </div>
      )}
      
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