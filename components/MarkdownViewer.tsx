// components/MarkdownViewer.tsx
'use client';

import { cn } from '@/lib/utils'; // <-- FIX: Added slash

interface MarkdownViewerProps {
  content: string;
  className?: string;
  onMouseUpCapture?: (e: React.MouseEvent) => void;
}

/**
 * A component that renders Markdown/HTML content with consistent styling.
 * It uses a 'prose' class for typography.
 * * UPDATE: It now also correctly handles plain text by preserving whitespace.
 */
export function MarkdownViewer({
  content,
  className,
  onMouseUpCapture,
}: MarkdownViewerProps) {
  // Check if content looks like HTML or plain text
  const isHtml = /[<>]/g.test(content);

  if (isHtml) {
    // If it's HTML (from a rich-text note, for example), render it as prose
    return (
      <div
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none break-words',
          'prose-headings:font-semibold prose-h1:text-xl prose-h2:text-lg prose-h3:text-base',
          'prose-p:text-sm prose-p:leading-relaxed',
          'prose-a:text-primary hover:prose-a:text-primary/80',
          'prose-ul:list-disc prose-ol:list-decimal prose-li:my-0',
          'prose-blockquote:border-l-primary prose-blockquote:pl-4 prose-blockquote:italic',
          'prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted prose-code:font-mono prose-code:text-sm',
          'prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-md',
          className,
        )}
        dangerouslySetInnerHTML={{ __html: content }}
        onMouseUpCapture={onMouseUpCapture}
      />
    );
  }

  // If it's plain text (from a PDF/TXT extraction), render with preserved whitespace
  return (
    <pre
      className={cn(
        'text-sm whitespace-pre-wrap break-words font-sans text-foreground',
        className,
      )}
      onMouseUpCapture={onMouseUpCapture}
    >
      {content}
    </pre>
  );
}