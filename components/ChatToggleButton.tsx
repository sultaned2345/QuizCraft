// components/ChatToggleButton.tsx
// NEW FILE
'use client';

import { Button } from '@/components/ui/button';
import { MessageSquare, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface ChatToggleButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export function ChatToggleButton({ isOpen, onClick }: ChatToggleButtonProps) {
  return (
    <motion.div
      initial={{ scale: 0, y: 100 }}
      animate={{ scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.5 }}
      className="fixed bottom-5 right-5 z-50"
    >
      <Button
        onClick={onClick}
        size="icon"
        className="rounded-full w-14 h-14 shadow-lg"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageSquare className="h-6 w-6" />
        )}
      </Button>
    </motion.div>
  );
}