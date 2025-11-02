// src/app/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Upload, FileText, ArrowRight, Sparkles, FileSignature, StickyNote, Layers } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LandingPage() {
  const [inputMode, setInputMode] = useState<"text" | "file">("text"); // State is preserved for file handling logic
  const [textContent, setTextContent] = useState("");
  const [fileName, setFileName] = useState("");
  const { user, loading } = useAuth();
  const router = useRouter();

  const handleActionClick = () => {
    if (loading) return;
    
    // Store content in local storage to pass to create page (or use state management)
    // This is a simple way to pass the data without complex state.
    try {
      if (textContent) {
        localStorage.setItem("landingPageContent", textContent);
      } else {
        localStorage.removeItem("landingPageContent");
      }
      // We can't store the file, so we'll just redirect.
      // The `create` page will need to handle file uploads.
      // For now, this just directs the user to the right starting point.
    } catch (e) {
      console.error("Could not set item in local storage", e);
    }
    
    if (user) {
      // If they've added content, go to create page
      if (textContent || fileName) {
        router.push("/create");
      } else {
        router.push("/documents"); // Default to documents if no content
      }
    } else {
      router.push("/login");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setTextContent(""); // Clear text content
      // We'll let the /create page handle the actual upload
      // But we'll push to it
      handleActionClick();
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
            <Button onClick={() => router.push("/documents")}>My Documents</Button>
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

      {/* --- MODIFIED HERO --- */}
      <main className="container mx-auto px-4 py-24 md:py-40 text-center flex flex-col items-center">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight max-w-4xl">
          Your Personal AI Study Partner
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
          Upload any document, PDF, or note and instantly generate quizzes, flashcards, and summaries. Stop reading, start learning.
        </p>

        {/* --- NEW "v0-style" Input Area --- */}
        <div className="w-full max-w-3xl relative">
          <Textarea
            placeholder="Paste your notes, an article, or any text here to get started..."
            className="h-40 p-6 pr-40 text-base rounded-lg shadow-xl"
            value={textContent}
            onChange={(e) => {
              setTextContent(e.target.value);
              setFileName(""); // Clear file name if user types
            }}
          />
          <div className="absolute top-6 right-6 flex flex-col gap-2">
            <Button
              size="lg"
              className="w-full"
              onClick={handleActionClick}
              disabled={loading || (!textContent && !fileName)}
            >
              Get Started <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full relative"
              onClick={() => (document.getElementById('file-upload-landing') as HTMLInputElement)?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {fileName ? "File Selected!" : "Upload File"}
              <input
                type="file"
                id="file-upload-landing"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleFileChange}
                accept=".pdf,.txt,.docx,.pptx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              />
            </Button>
            {fileName && (
              <p className="text-xs text-muted-foreground truncate" title={fileName}>
                {fileName}
              </p>
            )}
          </div>
        </div>
      </main>
      {/* --- END HERO --- */}


      {/* --- MODIFIED FEATURES SECTION --- */}
      <section className="bg-white dark:bg-slate-800/30 py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">A Complete Toolkit for Effective Learning</h2>
            <p className="text-lg text-muted-foreground mt-3 max-w-2xl mx-auto">
              Go from document to deep understanding in minutes.
            </p>
          </div>
          {/* 3-column row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <FeatureCard
              icon={<FileText size={28} />}
              title="Chat with Documents"
              description="Upload your materials and ask specific questions. Our AI provides cited answers directly from your content."
            />
            <FeatureCard
              icon={<Sparkles size={28} />}
              title="Instant Quizzes"
              description="Instantly generate multiple-choice, true/false, and fill-in-the-blank quizzes from any document to test your knowledge."
            />
            <FeatureCard
              icon={<Layers size={28} />}
              title="Smart Flashcards"
              description="Create flashcard decks in one click from your notes, complete with spaced repetition to improve memory retention."
            />
          </div>
          {/* 2-column row, centered */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto mt-8">
            <FeatureCard
              icon={<FileSignature size={28} />}
              title="AI Essay Grader"
              description="Get instant, detailed feedback on your writing, complete with scores, highlights, and suggestions."
            />
            <FeatureCard
              icon={<StickyNote size={28} />}
              title="AI Note Summarizer"
              description="Paste text or a URL and get concise, structured notes on the key concepts."
            />
          </div>
        </div>
      </section>
      {/* --- END FEATURES --- */}

    </div>
  );
}