"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { supabaseHelpers } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MoreHorizontal, Copy, Edit, Trash2, Plus, LogOut, Sparkles, FileQuestion, BookCopy, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

interface Quiz {
  id: string;
  title: string;
  created_at: string;
  is_public: boolean;
  share_link: string | null;
  questionsCount: number;
}

const DashboardHeader = () => {
  const { user, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="py-4 px-6 md:px-12 flex justify-between items-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
      <Link href="/" className="flex items-center gap-2">
        <Sparkles className="w-6 h-6 text-primary" />
        <span className="text-xl font-bold">QuizCraft</span>
      </Link>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground hidden sm:inline">
          {user?.email}
        </span>
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </header>
  );
};

export default function DashboardPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
      return;
    }
    if (user) {
      fetchQuizzes();
    }
  }, [user, authLoading, router]);

  const fetchQuizzes = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const quizzesData = await supabaseHelpers.getQuizzes(user.id);
      const transformedQuizzes = quizzesData.map((quiz: any) => ({
        ...quiz,
        questionsCount: quiz.questions.length,
      }));
      setQuizzes(transformedQuizzes);
    } catch (error) {
      console.error("Error fetching quizzes:", error);
      toast({
        title: "Error",
        description: "Failed to load quizzes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyShareLink = (shareLink: string | null) => {
    if (!shareLink) {
        toast({ title: "Error", description: "This quiz doesn't have a share link.", variant: "destructive" });
        return;
    };
    const shareUrl = `${window.location.origin}/quiz/${shareLink}`;
    navigator.clipboard.writeText(shareUrl);
    toast({
      title: "Link copied!",
      description: "Share link has been copied to your clipboard.",
    });
  };

  const handleDeleteQuiz = async (quizId: string) => {
    if (confirm("Are you sure you want to delete this quiz? This action is permanent.")) {
      try {
        await supabaseHelpers.deleteQuiz(quizId);
        setQuizzes((prev) => prev.filter((quiz) => quiz.id !== quizId));
        toast({
          title: "Quiz deleted",
          description: "The quiz has been successfully removed.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete quiz. Please try again.",
          variant: "destructive",
        });
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <DashboardHeader />
        <div className="flex-grow flex items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="text-lg">Loading your quizzes...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8 md:py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-200">
            My Quizzes
          </h1>
          <Button asChild>
            <Link href="/create">
              <Plus className="w-4 h-4 mr-2" />
              New Quiz
            </Link>
          </Button>
        </div>

        {quizzes.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
            <BookCopy className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" />
            <h3 className="mt-4 text-lg font-semibold text-slate-800 dark:text-slate-200">No Quizzes Found</h3>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((quiz) => (
              <Card key={quiz.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg pr-2">{quiz.title}</CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 flex-shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/quiz/${quiz.id}`)}>
                          <FileQuestion className="w-4 h-4 mr-2" />
                          View Quiz
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/quiz/${quiz.id}/edit`)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Quiz
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleCopyShareLink(quiz.share_link)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Share Link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteQuiz(quiz.id)} className="text-destructive">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
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
                  <Badge variant={quiz.is_public ? "default" : "secondary"}>
                    {quiz.is_public ? "Public" : "Draft"}
                  </Badge>
                  <span className="text-muted-foreground">{formatDate(quiz.created_at)}</span>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}