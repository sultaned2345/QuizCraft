// components/ChatbotDialog.tsx
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Sparkles } from 'lucide-react';
import { usePageContext } from '@/contexts/PageContext'; 
import { ChatInterface } from '@/components/ChatInterface'; // Import the new component

interface ChatbotDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatbotDialog({ isOpen, onClose }: ChatbotDialogProps) {
  const { pageContext } = usePageContext(); // Get context from the provider

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] md:max-w-lg grid-rows-[auto_1fr_auto] max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            AI Tutor
          </DialogTitle>
          <DialogDescription>
            {pageContext?.type === 'document' ? "I can help you work with this document."
             : pageContext?.type === 'quiz' ? "Ask me to refine questions for this quiz."
             : pageContext?.type === 'essay' ? "Ask me follow-up questions about your feedback."
             : "Ask me anything about your study materials."}
          </DialogDescription>
        </DialogHeader>
        
        {/* Render the ChatInterface inside the dialog content, passing the context */}
        {/* We add padding here so the interface itself doesn't need it */}
        <ChatInterface
          context={pageContext}
          className="p-6 pt-0"
        />
        
        {/* No DialogFooter, as the form is now inside ChatInterface */}
      </DialogContent>
    </Dialog>
  );
}