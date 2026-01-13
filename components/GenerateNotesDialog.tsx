// components/GenerateNotesDialog.tsx
'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Loader2, AlertCircle, Youtube } from 'lucide-react';
import { ApiResponse } from '@/types/database'; 
import { useUpgradeModal } from '@/components/UpgradeModalContext'; 

interface GenerateNotesDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newNotes: { count: number }) => void;
    onError: (message: string) => void;
    documentId?: string; // <-- ADDED: Optional document context
}

export function GenerateNotesDialog({ isOpen, onClose, onSuccess, onError, documentId }: GenerateNotesDialogProps) {
    const [sourceType, setSourceType] = useState<'text' | 'url' | 'youtube'>('text');
    const [textContent, setTextContent] = useState('');
    const [urlContent, setUrlContent] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');

    const { session } = useAuth();
    const { openModal } = useUpgradeModal(); 

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (!session) {
            onError("Authentication error. Please log in again.");
            return;
        }

        if (sourceType === 'text' && !textContent.trim()) {
            setError("Please paste some text content.");
            return;
        }
        if (sourceType === 'url' && !urlContent.trim()) {
            setError("Please enter a valid URL.");
            return;
        }
        if (sourceType === 'youtube' && !youtubeUrl.trim()) {
            setError("Please enter a valid YouTube URL.");
            return;
        }

        setIsGenerating(true);

        try {
            let body: any = {};
            if (sourceType === 'text') {
                body = { text: textContent.trim() };
            } else if (sourceType === 'url') {
                body = { url: urlContent.trim() };
            } else if (sourceType === 'youtube') {
                body = { youtubeUrl: youtubeUrl.trim() };
            }

            // <-- ADDED: Include documentId in payload if present
            if (documentId) {
                body.documentId = documentId;
            }

            const response = await fetch('/api/generate-notes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(body),
            });

            const result: ApiResponse<{ count: number }> = await response.json(); 

            if (!response.ok || !result.success) {
                if (result.error === 'limit_exceeded') {
                    openModal();
                    throw new Error(result.message || 'AI generation limit reached.');
                }
                throw new Error(result.error || `Failed to generate notes (Status: ${response.status})`);
            }

            setTextContent('');
            setUrlContent('');
            setYoutubeUrl('');
            
            onSuccess(result.data || { count: 0 }); 

        } catch (err: any) {
            const errorMessage = err.message || 'An unknown error occurred.';
            if (!errorMessage.includes('limit reached')) {
                setError(errorMessage);
            }
            onError(errorMessage);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setTextContent('');
            setUrlContent('');
            setYoutubeUrl('');
            setError('');
            setIsGenerating(false);
            setSourceType('text');
        }
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                    <DialogTitle>Generate Note with AI</DialogTitle>
                    <DialogDescription>
                        Provide text, a URL, or a YouTube link to automatically generate a summary note.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="flex justify-center mb-4 border border-input rounded-lg p-1 w-min mx-auto bg-background">
                            <Button type="button" variant={sourceType === "text" ? "secondary" : "ghost"} onClick={() => setSourceType('text')} className="w-24 h-8 text-xs">Text</Button>
                            <Button type="button" variant={sourceType === "url" ? "secondary" : "ghost"} onClick={() => setSourceType('url')} className="w-24 h-8 text-xs">URL</Button>
                            <Button type="button" variant={sourceType === "youtube" ? "secondary" : "ghost"} onClick={() => setSourceType('youtube')} className="w-24 h-8 text-xs">
                                <Youtube className="w-4 h-4 mr-1" />
                                YouTube
                            </Button>
                        </div>

                         {sourceType === 'text' && (
                             <div className="grid gap-2">
                                <Label htmlFor="text-content">Paste Text</Label>
                                <Textarea
                                    id="text-content"
                                    value={textContent}
                                    onChange={(e) => setTextContent(e.target.value)}
                                    placeholder="Paste the content you want to summarize..."
                                    disabled={isGenerating}
                                    required={sourceType === 'text'}
                                    className="min-h-[150px]"
                                />
                            </div>
                         )}

                         {sourceType === 'url' && (
                             <div className="grid gap-2">
                                <Label htmlFor="url-content">Enter URL</Label>
                                <Input
                                    id="url-content"
                                    type="url"
                                    value={urlContent}
                                    onChange={(e) => setUrlContent(e.target.value)}
                                    placeholder="https://example.com/article"
                                    disabled={isGenerating}
                                    required={sourceType === 'url'}
                                />
                                <p className="text-xs text-muted-foreground">Note: AI works best with article-like content.</p>
                            </div>
                         )}

                         {sourceType === 'youtube' && (
                             <div className="grid gap-2">
                                <Label htmlFor="youtube-url-content">YouTube URL</Label>
                                <Input
                                    id="youtube-url-content"
                                    type="url"
                                    value={youtubeUrl}
                                    onChange={(e) => setYoutubeUrl(e.target.value)}
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    disabled={isGenerating}
                                    required={sourceType === 'youtube'}
                                />
                                <p className="text-xs text-muted-foreground">Note: This only works for videos that have transcripts available.</p>
                            </div>
                         )}

                         {error && (
                            <div className="flex items-start gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                          )}
                    </div>
                     <DialogFooter>
                         <DialogClose asChild>
                            <Button type="button" variant="ghost" disabled={isGenerating}>Cancel</Button>
                         </DialogClose>
                        <Button 
                            type="submit" 
                            disabled={
                                isGenerating || 
                                (sourceType === 'text' && !textContent.trim()) || 
                                (sourceType === 'url' && !urlContent.trim()) ||
                                (sourceType === 'youtube' && !youtubeUrl.trim())
                            }
                        >
                            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Generate Note
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}