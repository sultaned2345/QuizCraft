// components/ChatWidgetContainer.tsx
// NEW FILE
'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePageContext } from '@/contexts/PageContext';
import dynamic from 'next/dynamic';

// Lazy-load the chat interface
const DynamicChatInterface = dynamic(
  () => import('@/components/ChatInterface').then((mod) => mod.ChatInterface),
  {
    loading: () => (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    ),
    ssr: false,
  }
);

interface ChatWidgetContainerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatWidgetContainer({
  isOpen,
  onClose,
}: ChatWidgetContainerProps) {
  const { pageContext } = usePageContext();

  const getTitle = () => {
    if (pageContext?.type === 'document') return 'AI Tutor (Document)';
    if (pageContext?.type === 'quiz') return 'AI Tutor (Quiz)';
    if (pageContext?.type === 'essay') return 'AI Tutor (Essay)';
    return 'AI Tutor';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed bottom-24 right-5 z-50 w-full max-w-md"
        >
          <Card className="h-[60vh] max-h-[700px] flex flex-col shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 py-3 px-4 border-b">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span className="font-semibold">{getTitle()}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
                <span className="sr-only">Close chat</span>
              </Button>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-hidden">
              {/* ChatInterface now fills this container */}
              <DynamicChatInterface
                context={pageContext}
                className="h-full" // Pass className to fill height
              />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}