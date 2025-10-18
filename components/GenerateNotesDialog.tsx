'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Note } from '@/types/database';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


interface GenerateNotesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newNotes: Note[]) => void;
  onError: (errorMessage: string) => void;
}

export function GenerateNotesDialog({ isOpen, onClose, onSuccess, onError }: GenerateNotesDialogProps) {
  const [text, setText] = useState('');
  const [numberOfNotes, setNumberOfNotes] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const { session } = useAuth();

  const handleGenerate = async () => {
    if (!text.trim()) {
      onError('Please paste some text to generate notes from.');
      return;
    }
    if (!session) {
      onError('You must be logged in to use this feature.');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/generate-notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          text,
          number_of_notes: numberOfNotes,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to generate notes.');
      }

      onSuccess(result.notes);
      setText(''); // Clear text area on success
    } catch (error: any) {
      onError(error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Generate Notes with AI</DialogTitle>
          <DialogDescription>
            Paste your raw text below, and AI will summarize it into structured notes for you.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full items-center gap-2">
            <Label htmlFor="text-content">Source Text</Label>
            <Textarea
              id="text-content"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[200px]"
              placeholder="Paste a chapter from a textbook, meeting transcript, or lecture notes here..."
              disabled={isGenerating}
            />
          </div>
          <div className="grid w-full max-w-sm items-center gap-2">
              <Label htmlFor="number-of-notes">Number of Notes</Label>
               <Select
                    value={String(numberOfNotes)}
                    onValueChange={(val) => setNumberOfNotes(Number(val))}
                    disabled={isGenerating}
                >
                    <SelectTrigger>
                        <SelectValue placeholder="Select number of notes" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="3">3 Notes</SelectItem>
                        <SelectItem value="5">5 Notes</SelectItem>
                        <SelectItem value="7">7 Notes</SelectItem>
                        <SelectItem value="10">10 Notes</SelectItem>
                    </SelectContent>
                </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={isGenerating}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}