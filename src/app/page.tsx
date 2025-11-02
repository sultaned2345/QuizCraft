// src/app/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
// --- MODIFICATION: Import new icons ---
import { Upload, FileText, ArrowRight, Sparkles, FileSignature, StickyNote, Layers } from "lucide-react";
// ---
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LandingPage() {
  const [inputMode, setInputMode] = useState<"text" | "file">("text");
  const [textContent, setTextContent] = useState("");
  const [fileName, setFileName] = useState("");
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleActionClick = () => {
    if (loading) return;
    if (user) {
      // --- MODIFICATION: Go to documents or create ---
      // If they've added content, go to create. Otherwise, documents.
      if (textContent || fileName) {
        router.push("/create");
      } else {
        router.push("/documents");
      }
      // --- END MODIFICATION ---
    } else {
      router.push("/login");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      // In a real scenario, you might read the file content here
      // or prepare it for upload on the create page.
    }
  };

  const FeatureCard = ({
    icon,
    title,
    description,
  }: {
    icon: React.ReactNode;
    title: string;
    description: string;
  }) => (
    <div className="flex flex-col items-center text-center p-6 bg-white dark:bg-slate-800/50 rounded-lg shadow-sm hover:shadow-lg transition-shadow">
      <div className="mb-4 text-primary">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      {/* Header (remains the same) */}
      <header className="py-4 px-6 md:px-12 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          <span className="text-xl font-bold">QuizCraft</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {loading ? null : user ? (
            // --- MODIFICATION: Link to Documents ---
            <Button onClick={() => router.push("/documents")}>My Documents</Button>
            // --- END MODIFICATION ---
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Log In</Link>
              </Button>
              <Button asChild>
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Hero Section (MODIFIED) */}
      <main className="container mx-auto px-4 py-16 md:py-24 text-center">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-4 leading-tight">
          Chat With Your Documents
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Upload your study materials, lecture notes, or any PDF, and our AI will help you learn.
          Generate quizzes, flashcards, and summaries instantly.
        </p>
        {/* --- END MODIFICATION --- */}

        <Card className="max-w-2xl mx-auto p-4 md:p-6 shadow-xl bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
          <CardContent className="p-0">
            <div className="flex justify-center mb-4 border border-slate-200 dark:border-slate-700 rounded-lg p-1 w-min mx-auto">
              <Button
                variant={inputMode === "text" ? "secondary" : "ghost"}
                onClick={() => setInputMode("text")}
                className="w-32"
              >
                <FileText className="w-4 h-4 mr-2" />
                Text
              </Button>
              <Button
                variant={inputMode === "file" ? "secondary" : "ghost"}
                onClick={() => setInputMode("file")}
                className="w-32"
              >
                <Upload className="w-4 h-4 mr-2" />
                File
              </Button>
            </div>

            {inputMode === "text" ? (
              <Textarea
                placeholder="Paste your notes, an article, or any text here..."
                className="h-32 text-base"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
              />
            ) : (
              <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 flex flex-col items-center justify-center">
                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                <p className="font-semibold">
                  {fileName || "Click to upload a file"}
                </p>
                <p className="text-sm text-muted-foreground">
                  PDF, TXT, DOCX, PPTX (Max 3MB)
                </p>
                <input
                  type="file"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={handleFileChange}
                  accept=".pdf,.txt,.docx,.pptx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                />
              </div>
            )}

            <Button
              size="lg"
              className="w-full mt-4 text-lg"
              onClick={handleActionClick}
              disabled={loading} // Only disable on auth loading
            >
              Get Started <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </main>

      {/* --- MODIFICATION: Features Section (Updated copy) --- */}
      <section className="bg-white dark:bg-slate-800/30 py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">A Full Study Toolkit</h2>
            <p className="text-muted-foreground mt-2">
              All powered by your personal document library.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <FeatureCard
              icon={<FileText size={28} />}
              title="Chat with Documents"
              description="Upload your materials and ask questions. Our AI provides cited answers from your content."
            />
            <FeatureCard
              icon={<Sparkles size={28} />}
              title="AI-Powered Quizzes"
              description="Instantly generate quizzes from any document to test your knowledge."
            />
            <FeatureCard
              icon={<Layers size={28} />}
              title="Smart Flashcards"
              description="Create decks in one click from your notes, or study with spaced repetition."
            />
            <FeatureCard
              icon={<FileSignature size={28} />}
              title="AI Essay Grader"
              description="Get instant, detailed feedback on your writing, complete with scores and suggestions."
            />
          </div>
        </div>
      </section>
      {/* --- END MODIFICATION --- */}

      {/* Footer is now handled by layout.tsx */}
    </div>
  );
}