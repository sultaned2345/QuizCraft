// components/MarkdownViewer.tsx
'use client';

import { cn } from '@/lib/utils';

interface MarkdownViewerProps {
  content: string;
  className?: string;
  onMouseUpCapture?: (e: React.MouseEvent) => void;
}

/**
 * A component that renders Markdown/HTML content with "Premium Article" typography.
 */
export function MarkdownViewer({
  content,
  className,
  onMouseUpCapture,
}: MarkdownViewerProps) {
  // Check if content looks like HTML or plain text
  const isHtml = /[<>]/g.test(content);

  if (isHtml) {
    return (
      <div
        className={cn(
          'prose prose-slate dark:prose-invert max-w-none',
          // Typography Overrides for "Turbo" feel
          'prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-zinc-900 dark:prose-headings:text-zinc-100',
          'prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl',
          'prose-p:leading-8 prose-p:text-zinc-700 dark:prose-p:text-zinc-300', // Relaxed reading
          'prose-li:marker:text-zinc-400',
          'prose-blockquote:border-l-4 prose-blockquote:border-primary/50 prose-blockquote:bg-muted/30 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:not-italic prose-blockquote:rounded-r-lg',
          'prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:text-zinc-900 dark:prose-code:text-zinc-100 prose-code:before:content-none prose-code:after:content-none',
          className
        )}
        dangerouslySetInnerHTML={{ __html: content }}
        onMouseUpCapture={onMouseUpCapture}
      />
    );
  }

  // Plain Text (with nice formatting)
  return (
    <div
      className={cn(
        'font-sans text-base leading-8 text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap',
        className,
      )}
      onMouseUpCapture={onMouseUpCapture}
    >
      {content}
    </div>
  );
}