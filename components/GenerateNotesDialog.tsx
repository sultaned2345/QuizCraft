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
import { Loader2, AlertCircle } from 'lucide-react';
import { ApiResponse, Note } from '@/types/database'; // Import Note if needed for onSuccess
import { useUpgradeModal } from '@/components/UpgradeModalContext'; // <-- 1. FIXED IMPORT PATH

interface GenerateNotesDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newNotes: { count: number }) => void; // Update onSuccess type if API returns different data
    onError: (message: string) => void;
}

export function GenerateNotesDialog({ isOpen, onClose, onSuccess, onError }: GenerateNotesDialogProps) {
    const [sourceType, setSourceType] = useState<'text' | 'url'>('text');
    const [textContent, setTextContent] = useState('');
    const [urlContent, setUrlContent] = useState('');
    // REMOVED: const [numberOfNotes, setNumberOfNotes] = useState(3);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');

    const { session } = useAuth();
    const { openModal } = useUpgradeModal(); // <-- 2. GET MODAL FUNCTION

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

        setIsGenerating(true);

        try {
            const body = sourceType === 'text'
                ? { text: textContent.trim() } // Remove number_of_notes
                : { url: urlContent.trim() }; // Remove number_of_notes

            const response = await fetch('/api/generate-notes', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify(body),
            });

            const result: ApiResponse<{ count: number }> = await response.json(); // Expect count in response

            if (!response.ok || !result.success) {
                // --- 3. CATCH LIMIT ERROR ---
                if (result.error === 'limit_exceeded') {
                    openModal();
                    throw new Error(result.message || 'AI generation limit reached.');
                }
                // ---
                throw new Error(result.error || `Failed to generate notes (Status: ${response.status})`);
            }

            // Clear inputs on success
            setTextContent('');
            setUrlContent('');
            onSuccess(result.data || { count: 0 }); // Pass back the count or default

        } catch (err: any) {
            // --- 4. HANDLE ERROR MESSAGING ---
            const errorMessage = err.message || 'An unknown error occurred.';
            // Don't show modal error in the dialog UI
            if (!errorMessage.includes('limit reached')) {
                setError(errorMessage);
            }
            onError(errorMessage);
            // ---
        } finally {
            setIsGenerating(false);
        }
    };

    // Reset state when dialog opens/closes
    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setTextContent('');
            setUrlContent('');
            setError('');
            setIsGenerating(false);
        }
        onClose(); // Call original onClose handler
    };


    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[525px]">
                <DialogHeader>
                    <DialogTitle>Generate Note with AI</DialogTitle>
                    <DialogDescription>
                        Provide text content or a URL to automatically generate a summary note.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                         {/* Source Type Toggle */}
                        <div className="flex justify-center mb-4 border border-input rounded-lg p-1 w-min mx-auto bg-background">
                            <Button type="button" variant={sourceType === "text" ? "secondary" : "ghost"} onClick={() => setSourceType('text')} className="w-24 h-8 text-xs">Text</Button>
                            <Button type="button" variant={sourceType === "url" ? "secondary" : "ghost"} onClick={() => setSourceType('url')} className="w-24 h-8 text-xs">URL</Button>
                        </div>

                         {/* Text Input */}
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

                         {/* URL Input */}
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

                         {/* REMOVED: Number of Notes Input */}

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
                        <Button type="submit" disabled={isGenerating || (sourceType === 'text' && !textContent.trim()) || (sourceType === 'url' && !urlContent.trim())}>
                            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Generate Note
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}