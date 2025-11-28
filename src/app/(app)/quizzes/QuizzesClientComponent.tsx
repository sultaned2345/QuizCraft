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
import { 
  MoreHorizontal, Edit, Trash2, Plus, FileQuestion, Loader2, 
  Combine, History, Play, RefreshCw, Trophy, Brain 
} from 'lucide-react';
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

// ... (Interface definitions remain the same) ...
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
  // ---

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
  }, [user, session, toast, quizzesPerPage, isLoadingMore, totalPages]);

  const handleLoadMore = () => {
    console.log("Load More clicked. Requires /api/quizzes endpoint.");
    toast({ title: "Load More", description: "This requires a dedicated API endpoint." });
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
      setQuizzes(originalQuizzes); // Rollback
      setTotalQuizzes(prev => prev + 1); // Rollback
    } finally {
      setIsDeleting(false); 
    }
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
    } catch (error: any)
{
      toast({ title: "Combine Failed", description: error.message, variant: "destructive" });
      setIsCombining(false);
    }
  };

  // Helper to determine score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800";
    if (score >= 60) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800";
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

      {/* (Quizzes Section Header) */}
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

      {/* (Grid or Empty State) */}
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
            const latestAttempt = recentAttempts.find(a => a.quiz_id === quiz.id);
            const hasAttempted = !!latestAttempt;

            return (
              <motion.div key={quiz.id} variants={itemVariants}>
                <Card
                  className={cn(
                    'flex flex-col h-full relative overflow-hidden group transition-all duration-300',
                    'hover:-translate-y-1 hover:shadow-lg',
                    'border-muted/60 dark:border-muted/40',
                    selectedQuizIds.includes(quiz.id) ? 'ring-2 ring-primary border-primary' : ''
                  )}
                >
                  {/* --- DECORATIVE WATERMARK ICON --- */}
                  <div className="absolute -right-6 -top-6 opacity-[0.03] dark:opacity-[0.05] pointer-events-none transition-transform group-hover:scale-110 group-hover:rotate-12">
                    <Brain className="w-48 h-48" />
                  </div>

                  <CardHeader className="pb-3 z-10">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3 pr-2 w-full">
                        <Checkbox
                          id={`select-${quiz.id}`}
                          checked={selectedQuizIds.includes(quiz.id)}
                          onCheckedChange={() => handleToggleSelectQuiz(quiz.id)}
                          className="mt-1.5"
                          aria-label={`Select quiz ${quiz.title}`}
                        />
                        <div className="space-y-1 w-full">
                          <label htmlFor={`select-${quiz.id}`} className="cursor-pointer block">
                            <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors">
                              {quiz.title}
                            </CardTitle>
                          </label>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="font-normal text-[10px] h-5 px-1.5">
                              {quiz.questionsCount} Qs
                            </Badge>
                            <span>•</span>
                            <span>{new Date(quiz.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* --- FLOATING ACTION MENU --- */}
                      <AlertDialog>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 shrink-0 -mr-2 text-muted-foreground hover:bg-background/80 backdrop-blur-sm"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/quiz/${quiz.id}/edit`)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Edit Quiz
                            </DropdownMenuItem>
                            {/* Copy Link REMOVED here */}
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
                  </CardHeader>

                  <CardContent className="flex-grow z-10 pt-0">
                    <div className="mt-2">
                       {hasAttempted ? (
                        <div className={cn(
                          "flex items-center justify-between p-2 rounded-lg border text-xs font-medium",
                          getScoreColor(latestAttempt.score)
                        )}>
                          <div className="flex items-center gap-2">
                            <Trophy className="w-3.5 h-3.5" />
                            <span>Last Score</span>
                          </div>
                          <span className="text-sm font-bold">{Math.round(latestAttempt.score)}%</span>
                        </div>
                       ) : (
                         <div className="p-2 rounded-lg border border-dashed text-xs text-muted-foreground bg-muted/30 flex items-center justify-center gap-2">
                           <History className="w-3.5 h-3.5" />
                           <span>Not attempted yet</span>
                         </div>
                       )}
                    </div>
                  </CardContent>

                  <div className="relative w-full h-px border-t-2 border-dashed border-muted my-0" />

                  <CardFooter className="flex justify-between items-center text-sm pt-4 z-10 bg-muted/5">
                    <Badge variant={quiz.is_public ? 'outline' : 'secondary'} className="text-xs font-normal">
                      {quiz.is_public ? 'Public' : 'Draft'}
                    </Badge>
                    
                    <Button asChild size="sm" className={cn(
                      "transition-all shadow-sm",
                      hasAttempted ? "hover:bg-primary/90" : "bg-primary hover:bg-primary/90"
                    )}>
                      <Link href={`/quiz/${quiz.id}`}>
                        {hasAttempted ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Try Again
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2 fill-current" />
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

      {/* (Load More Button and Combine Dialog remain the same) */}
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
        {/* ... (Dialog content remains the same) ... */}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Combine Quizzes</DialogTitle>
            <DialogDescription>
              Create a new quiz from the {selectedQuizIds.length} quizzes you selected.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCombineQuizzes}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="combine-title" className="text-right">New Title</Label>
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
                <Button type="button" variant="ghost" disabled={isCombining}>Cancel</Button>
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