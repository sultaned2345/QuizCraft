'use client';

import { useState, useEffect, useMemo } from 'react';
import { 
  Loader2, 
  Sparkles, 
  ChevronLeft,
  Save,
  Tag as TagIcon,
  X,
  Play,
  Pause,
  BookOpen,
  Maximize2,
  Minimize2,
  Clock,
  BrainCircuit,
  GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { RichTextEditor } from '@/components/RichTextEditor';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

// --- Sub-Components ---
import { NoteQuizGenerator } from './NoteQuizGenerator';
import { NoteConnections } from './NoteConnections';

interface NoteEditorProps {
  noteId?: string;      
  documentId?: string; 
  initialTitle?: string;
  initialContent?: string;
  initialTags?: string[]; 
  initialLinkedIds?: string[];
  isReadOnly?: boolean; 
}

export function NoteEditor({ 
  noteId, 
  documentId, 
  initialTitle = '', 
  initialContent = '', 
  initialTags = [], 
  initialLinkedIds = [],
  isReadOnly = false 
}: NoteEditorProps) {
  const { session } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  
  const activeId = noteId || documentId;

  // --- Core State ---
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [linkedIds, setLinkedIds] = useState<string[]>(initialLinkedIds);
  const [tagInput, setTagInput] = useState('');
  
  // --- UI/Mode State ---
  const [isStudyMode, setIsStudyMode] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  
  // --- Study Features State ---
  const [isPlaying, setIsPlaying] = useState(false);
  const [headers, setHeaders] = useState<{ id: string; text: string; level: number }[]>([]);
  
  // Extract confidence from tags (format: "status:mastered") or default to "learning"
  const [confidence, setConfidence] = useState(() => {
    const statusTag = initialTags.find(t => t.startsWith('status:'));
    return statusTag ? statusTag.replace('status:', '') : 'learning';
  });

  // --- Derived Stats ---
  const readingTime = useMemo(() => {
    const words = content.replace(/<[^>]*>/g, '').split(/\s+/).length;
    return Math.ceil(words / 200); // ~200 wpm average
  }, [content]);

  // --- Effects ---

  // Auto-save Logic
  useEffect(() => {
    if (isReadOnly) return;
    const timer = setTimeout(() => {
      // Check for any changes
      if (activeId && (
          title !== initialTitle || 
          content !== initialContent || 
          tags !== initialTags ||
          linkedIds !== initialLinkedIds
      )) {
        handleSave(false);
      }
    }, 3000); // 3-second debounce
    return () => clearTimeout(timer);
  }, [title, content, tags, linkedIds, activeId]);

  // Text-to-Speech Handler
  useEffect(() => {
    if (!isPlaying) {
      window.speechSynthesis.cancel();
      return;
    }

    const plainText = content.replace(/<[^>]*>/g, '');
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.onend = () => setIsPlaying(false);
    
    // Optional: Select a better voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google')) || voices[0];
    if (preferredVoice) utterance.voice = preferredVoice;

    window.speechSynthesis.speak(utterance);

    return () => window.speechSynthesis.cancel();
  }, [isPlaying, content]);

  // --- Handlers ---

  const handleSave = async (manual: boolean = false) => {
    if (isReadOnly || !activeId) return;

    setIsSaving(true);
    try {
      // Filter out old status tag and add new one
      const cleanTags = tags.filter(t => !t.startsWith('status:'));
      const finalTags = [...cleanTags, `status:${confidence}`];

      const res = await fetch(`/api/notes/${activeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ 
          title, 
          content, 
          tags: finalTags,
          linked_note_ids: linkedIds
        }),
      });

      if (!res.ok) throw new Error();
      
      setLastSaved(new Date());
      // Update local tags state to match what we sent (to prevent infinite save loops)
      setTags(finalTags); 
      
      if (manual) toast({ description: "Note saved." });
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", description: "Failed to save." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newTag = tagInput.trim().toLowerCase();
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
        setTagInput('');
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleAiExpand = async () => {
     setIsAiGenerating(true);
     toast({ title: "Neural Engine Active", description: "Analyzing context and generating expansion..." });
     
     // Simulate AI delay (Replace with actual API call to /api/notes/expand later)
     setTimeout(() => {
         setContent(prev => prev + `<p><strong>[AI Insight]:</strong> Expanding on <em>${title}</em>... consider how this concept applies to real-world distributed systems.</p>`);
         setIsAiGenerating(false);
     }, 2000);
  };

  return (
    <div className={cn(
        "flex flex-col bg-background/50 transition-all duration-500",
        isFocusMode ? "fixed inset-0 z-50 bg-background" : "h-[calc(100vh-4rem)] max-w-7xl mx-auto relative"
    )}>
      
      {/* 1. Interactive Top Bar */}
      <div className={cn(
          "flex items-center justify-between py-4 px-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20 transition-all",
          isStudyMode ? "border-yellow-500/30 bg-yellow-500/5" : "border-border"
      )}>
        
        {/* Left: Navigation & Stats */}
        <div className="flex items-center gap-4">
          <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => isFocusMode ? setIsFocusMode(false) : router.back()}
              className="gap-2 text-muted-foreground hover:text-foreground"
          >
              <ChevronLeft className="w-4 h-4" /> 
              {isFocusMode ? "Exit Focus" : "Back"}
          </Button>

          <div className="hidden md:flex items-center gap-4 text-xs font-medium text-muted-foreground border-l pl-4 ml-2">
            <span className="flex items-center gap-1.5" title="Estimated reading time">
                <Clock className="w-3.5 h-3.5" /> {readingTime} min read
            </span>
            <span className="flex items-center gap-1.5">
                {isSaving ? (
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                )}
                {isSaving ? 'Saving...' : 'Saved'}
            </span>
          </div>
        </div>
        
        {/* Right: Tools & Actions */}
        <div className="flex items-center gap-2">
            <div className="flex items-center bg-secondary/50 rounded-lg p-1 mr-2 gap-1">
                <Button
                    size="sm"
                    variant={isPlaying ? "default" : "ghost"}
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="h-8 px-3"
                    title="Read Aloud"
                >
                    {isPlaying ? <Pause className="w-3.5 h-3.5 mr-2" /> : <Play className="w-3.5 h-3.5 mr-2" />}
                    <span className="hidden sm:inline">Listen</span>
                </Button>

                <Button
                    size="sm"
                    variant={isStudyMode ? "default" : "ghost"}
                    onClick={() => setIsStudyMode(!isStudyMode)}
                    className={cn("h-8 px-3 transition-colors", isStudyMode ? "bg-yellow-500 hover:bg-yellow-600 text-white" : "")}
                >
                    <BookOpen className="w-3.5 h-3.5 mr-2" />
                    <span className="hidden sm:inline">Study Mode</span>
                </Button>
            </div>

            <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsFocusMode(!isFocusMode)}
                title={isFocusMode ? "Exit Fullscreen" : "Enter Focus Mode"}
            >
                {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            
            {!isReadOnly && !isStudyMode && (
                 <Button onClick={() => handleSave(true)} size="sm" className="gap-2 ml-2">
                    <Save className="w-4 h-4" /> Save
                 </Button>
            )}
        </div>
      </div>

      {/* 2. Main Layout Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Column: Table of Contents (Auto-Generated) */}
        <AnimatePresence>
            {!isFocusMode && headers.length > 0 && (
                <motion.div 
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 256 }}
                    exit={{ opacity: 0, width: 0 }}
                    className="hidden lg:block border-r border-border/50 overflow-y-auto bg-card/30"
                >
                    <div className="p-6">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                            <BookOpen className="w-3 h-3" /> Contents
                        </h3>
                        <nav className="space-y-1 relative border-l border-border/50 ml-1">
                            {headers.map((header, i) => (
                                <a 
                                    key={i} 
                                    href={`#`} // Ideally link to element ID
                                    onClick={(e) => { e.preventDefault(); /* Scroll logic here */ }}
                                    className={cn(
                                        "block text-sm py-1.5 px-3 -ml-px border-l-2 border-transparent transition-colors hover:border-primary/50 hover:bg-muted/50",
                                        "text-muted-foreground hover:text-foreground",
                                        header.level === 1 ? "font-medium text-foreground" : "text-xs pl-5"
                                    )}
                                >
                                    {header.text}
                                </a>
                            ))}
                        </nav>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Center Column: The Editor */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            <div className={cn(
                "mx-auto px-6 py-12 flex flex-col gap-8 transition-all duration-500",
                isFocusMode ? "max-w-3xl" : "max-w-4xl"
            )}>
                
                {/* Editor Header: Title & Metadata */}
                <div className="space-y-6">
                    {/* Title Input */}
                    {!isStudyMode ? (
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Note Title"
                            className="text-4xl font-bold bg-transparent border-none shadow-none px-0 h-auto placeholder:text-muted-foreground/30 focus-visible:ring-0"
                        />
                    ) : (
                        <h1 className="text-4xl font-bold px-0 text-foreground">{title}</h1>
                    )}

                    {/* Metadata Bar */}
                    <div className="flex flex-wrap items-center gap-4 p-1">
                         {/* Confidence Selector */}
                         <Select value={confidence} onValueChange={setConfidence}>
                            <SelectTrigger className={cn(
                                "w-[130px] h-8 text-xs border-none shadow-sm transition-colors",
                                confidence === 'mastered' ? "bg-green-500/10 text-green-600 dark:text-green-400" :
                                confidence === 'review' ? "bg-red-500/10 text-red-600 dark:text-red-400" :
                                "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
                            )}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="learning">🟡 Learning</SelectItem>
                                <SelectItem value="review">🔴 To Review</SelectItem>
                                <SelectItem value="mastered">🟢 Mastered</SelectItem>
                            </SelectContent>
                         </Select>

                         <div className="h-4 w-px bg-border" />

                         {/* Tag List */}
                        <div className="flex flex-wrap items-center gap-2">
                            {tags.filter(t => !t.startsWith('status:')).map(tag => (
                                <Badge key={tag} variant="secondary" className="gap-1 font-normal text-muted-foreground bg-secondary/50 hover:bg-secondary">
                                    #{tag}
                                    {!isReadOnly && !isStudyMode && (
                                        <X 
                                            className="w-3 h-3 cursor-pointer hover:text-destructive transition-colors" 
                                            onClick={() => removeTag(tag)} 
                                        />
                                    )}
                                </Badge>
                            ))}
                            {!isReadOnly && !isStudyMode && (
                                <div className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors bg-muted/30 hover:bg-muted/60 px-2 py-1 rounded-md cursor-text" onClick={() => document.getElementById('tag-input')?.focus()}>
                                    <TagIcon className="w-3 h-3" />
                                    <input
                                        id="tag-input"
                                        className="bg-transparent border-none outline-none text-xs w-20"
                                        placeholder="Add tag..."
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={handleAddTag}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* The Rich Text Editor */}
                <RichTextEditor 
                    content={content} 
                    onChange={setContent}
                    onHeadersUpdate={setHeaders}
                    editable={!isReadOnly}
                    isStudyMode={isStudyMode}
                    className="min-h-[60vh] border-none shadow-none bg-transparent"
                />

                {/* Bottom Section: Knowledge Graph & Actions */}
                <div className="space-y-8 pb-20">
                    {/* Knowledge Connections Widget */}
                    {!isFocusMode && !isStudyMode && (
                       <NoteConnections 
                          currentNoteId={activeId || ''}
                          initialLinkedIds={linkedIds}
                          isReadOnly={isReadOnly}
                          onLinksChange={setLinkedIds}
                       />
                    )}

                    {/* AI Expand Action */}
                    {!isStudyMode && (
                         <div className="flex justify-center pt-8 opacity-50 hover:opacity-100 transition-opacity">
                            <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={handleAiExpand} 
                                disabled={isAiGenerating} 
                                className="gap-2 shadow-sm"
                            >
                                 {isAiGenerating ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                 ) : (
                                    <Sparkles className="w-3 h-3 text-purple-500" />
                                 )}
                                 {isAiGenerating ? 'Generating Insight...' : 'AI Expand Note'}
                            </Button>
                         </div>
                    )}
                </div>
            </div>
        </div>

        {/* Right Column: AI & Quiz Generator */}
        <AnimatePresence>
            {!isFocusMode && (
                <motion.div 
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 320 }} // Slightly wider for better quiz UI
                    exit={{ opacity: 0, width: 0 }}
                    className="hidden xl:block border-l border-border/50 bg-muted/10"
                >
                    <NoteQuizGenerator 
                       noteId={activeId || ''}
                       noteTitle={title}
                       noteContent={content}
                    />
                </motion.div>
            )}
        </AnimatePresence>

      </div>
    </div>
  );
}