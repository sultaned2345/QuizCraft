// src/app/(app)/quizzes/QuizzesClientComponent.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  MoreHorizontal, Edit, Trash2, Plus, FileQuestion, Loader2, 
  Combine, History, Play, RefreshCw, Trophy 
} from 'lucide-react';
import { Quiz, QuizAttempt, ApiResponse } from '@/types/database';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, 
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
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
  initialData?: DashboardData; // Make optional
}

export function QuizzesClientComponent({ initialData }: QuizzesClientComponentProps) { 
  // Defensive default: Ensure we always have a valid object to read from
  const safeData = initialData || {
    quizzes: [],
    totalQuizCount: 0,
    quizzesTotalPages: 1,
    quizzesCurrentPage: 1,
    dueCardCount: 0,
    recentAttempts: []
  };

  const [quizzes, setQuizzes] = useState<DashboardQuiz[]>(safeData.quizzes);
  const [totalQuizzes, setTotalQuizzes] = useState(safeData.totalQuizCount);
  const [recentAttempts, setRecentAttempts] = useState(safeData.recentAttempts);
  
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
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } },
  };

  const refreshDashboard = () => {
    router.refresh();
    setSelectedQuizIds([]);
    setNewCombineTitle("");
    setIsCombining(false);
    setIsCombineDialogOpen(false);
    setIsDeleting(false);
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (!session) return;
    const quizToDelete = quizzes.find(q => q.id === quizId);
    if (!quizToDelete) return;

    const originalQuizzes = [...quizzes];
    setQuizzes(prev => prev.filter(q => q.id !== quizId));
    setTotalQuizzes(prev => prev - 1);
    setIsDeleting(true); 

    try {
        const response = await fetch(`/api/quiz/${quizId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${session.access_token}` },
        });
        const result: ApiResponse = await response.json();
        if (!result.success) throw new Error(result.error);

        toast({ title: "Quiz deleted", description: `"${quizToDelete.title}" removed.` });
        if (selectedQuizIds.includes(quizId)) {
          setSelectedQuizIds(prev => prev.filter(id => id !== quizId));
        }
    } catch (error: any) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
      setQuizzes(originalQuizzes);
      setTotalQuizzes(prev => prev + 1);
    } finally {
      setIsDeleting(false); 
    }
  };

  const handleToggleSelectQuiz = (quizId: string) => {
    setSelectedQuizIds((prev) =>
      prev.includes(quizId) ? prev.filter((id) => id !== quizId) : [...prev, quizId]
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
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      
      toast({ title: "Success", description: "Quizzes combined successfully." });
      refreshDashboard();
    } catch (error: any) {
      toast({ title: "Combine Failed", description: error.message, variant: "destructive" });
      setIsCombining(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200";
    if (score >= 60) return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200";
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200";
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
          <Button className="mt-6" asChild>
            <Link href="/create"><Plus className="w-4 h-4 mr-2" /> Create First Quiz</Link>
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
                <Card className={cn(
                    'flex flex-col h-full relative overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:shadow-lg',
                    selectedQuizIds.includes(quiz.id) ? 'ring-2 ring-primary border-primary' : ''
                  )}>
                  <CardHeader className="pb-3 z-10">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3 pr-2 w-full">
                        <Checkbox
                          checked={selectedQuizIds.includes(quiz.id)}
                          onCheckedChange={() => handleToggleSelectQuiz(quiz.id)}
                          className="mt-1.5"
                        />
                        <div className="space-y-1 w-full">
                          <CardTitle className="text-lg leading-tight group-hover:text-primary transition-colors cursor-pointer" onClick={() => handleToggleSelectQuiz(quiz.id)}>
                            {quiz.title}
                          </CardTitle>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="font-normal text-[10px] h-5 px-1.5">
                              {quiz.questionsCount} Qs
                            </Badge>
                            <span>•</span>
                            <span>{new Date(quiz.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>

                      <AlertDialog>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/quiz/${quiz.id}/edit`)}>
                              <Edit className="w-4 h-4 mr-2" /> Edit
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-destructive">
                                <Trash2 className="w-4 h-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Quiz?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteQuiz(quiz.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-grow z-10 pt-0">
                    <div className="mt-2">
                       {hasAttempted ? (
                        <div className={cn("flex items-center justify-between p-2 rounded-lg border text-xs font-medium", getScoreColor(latestAttempt.score))}>
                          <div className="flex items-center gap-2">
                            <Trophy className="w-3.5 h-3.5" /> <span>Last Score</span>
                          </div>
                          <span className="text-sm font-bold">{Math.round(latestAttempt.score)}%</span>
                        </div>
                       ) : (
                         <div className="p-2 rounded-lg border border-dashed text-xs text-muted-foreground bg-muted/30 flex items-center justify-center gap-2">
                           <History className="w-3.5 h-3.5" /> <span>Not attempted</span>
                         </div>
                       )}
                    </div>
                  </CardContent>

                  <CardFooter className="flex justify-between items-center text-sm pt-4 z-10 bg-muted/5">
                    <Badge variant={quiz.is_public ? 'outline' : 'secondary'} className="text-xs font-normal">
                      {quiz.is_public ? 'Public' : 'Draft'}
                    </Badge>
                    <Button asChild size="sm" className={cn("transition-all", hasAttempted ? "hover:bg-primary/90" : "bg-primary")}>
                      <Link href={`/quiz/${quiz.id}`}>
                        {hasAttempted ? <><RefreshCw className="w-4 h-4 mr-2"/> Retry</> : <><Play className="w-4 h-4 mr-2"/> Start</>}
                      </Link>
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            )
          })}
        </motion.div>
      )}

      <Dialog open={isCombineDialogOpen} onOpenChange={setIsCombineDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Combine Quizzes</DialogTitle>
            <DialogDescription>Create a master quiz from selected items.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCombineQuizzes}>
            <div className="py-4">
              <Label>New Title</Label>
              <Input 
                value={newCombineTitle} 
                onChange={(e) => setNewCombineTitle(e.target.value)} 
                placeholder="e.g. Final Exam Review"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isCombining || !newCombineTitle.trim()}>
                {isCombining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}