// components/NoteEditor.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Loader2, 
  Save, 
  Sparkles, 
  ChevronLeft,
  Share2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

// We'll use a simple textarea for now, but styled beautifully.
// In a real V2, this would be TipTap or Slate.js.

interface NoteEditorProps {
  noteId: string;
  initialTitle?: string;
  initialContent?: string;
}

export default function NoteEditor({ noteId, initialTitle = '', initialContent = '' }: NoteEditorProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Auto-save logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (title !== initialTitle || content !== initialContent) {
        handleSave(false);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [title, content]);

  const handleSave = async (manual: boolean = false) => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) throw new Error();
      
      setLastSaved(new Date());
      if (manual) {
        toast({ description: "Note saved successfully." });
      }
    } catch (e) {
      toast({ variant: "destructive", description: "Failed to save note." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiExpand = async () => {
    // Placeholder for AI expansion logic
    setIsAiGenerating(true);
    toast({ description: "Consulting Neural Engine..." });
    setTimeout(() => {
        setContent(prev => prev + "\n\n[AI SUGGESTION]: Consider exploring the connection between this topic and quantum mechanics...");
        setIsAiGenerating(false);
    }, 1500);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-4xl mx-auto relative">
      
      {/* 1. Top Bar (Minimal) */}
      <div className="flex items-center justify-between py-4 px-6 border-b border-white/5 bg-background/50 backdrop-blur-sm sticky top-0 z-20">
        <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push('/notes')}
            className="text-muted-foreground hover:text-white -ml-2 font-mono text-xs"
        >
            <ChevronLeft className="w-4 h-4 mr-1" /> BACK
        </Button>
        
        <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest hidden sm:block">
                {isSaving ? 'SAVING...' : lastSaved ? `SAVED ${lastSaved.toLocaleTimeString()}` : 'UNSAVED'}
            </span>
            <div className="h-4 w-px bg-white/10 mx-2" />
            <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleAiExpand}
                disabled={isAiGenerating}
                className="text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 h-8"
            >
                {isAiGenerating ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Sparkles className="w-3 h-3 mr-2" />}
                <span className="font-mono text-xs font-bold">EXPAND</span>
            </Button>
            <Button 
                size="sm" 
                className="bg-white text-black hover:bg-zinc-200 h-8 font-mono text-xs font-bold"
                onClick={() => handleSave(true)}
            >
                SAVE
            </Button>
        </div>
      </div>

      {/* 2. The Paper (Editor Area) */}
      <div className="flex-1 overflow-y-auto bg-background custom-scrollbar">
        <div className="max-w-3xl mx-auto px-8 py-12 flex flex-col gap-6 min-h-full">
            
            {/* Title Input (Borderless) */}
            <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note Title"
                className="w-full bg-transparent text-4xl font-bold text-white placeholder:text-zinc-700 focus:outline-none font-sans tracking-tight"
            />

            {/* Content Area (Typography Optimized) */}
            <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing..."
                className="flex-1 w-full resize-none bg-transparent border-none p-0 focus-visible:ring-0 text-lg leading-relaxed text-zinc-300 placeholder:text-zinc-800 font-serif min-h-[500px]"
                spellCheck={false}
            />
            
            {/* Footer decoration */}
            <div className="pt-20 pb-10 flex justify-center opacity-20">
                <div className="w-16 h-1 bg-white rounded-full" />
            </div>
        </div>
      </div>
    </div>
  );
}