// components/MarkdownViewer.tsx
'use client';

// We are now rendering HTML from Tiptap, not Markdown.
// react-markdown is not needed. We just use dangerouslySetInnerHTML.
import { cn } from '@/lib/utils';

interface MarkdownViewerProps {
  content: string;
  className?: string;
}

/**
 * A component that renders Markdown/HTML content with consistent styling.
 * It uses a 'prose' class for typography.
 */
export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
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
    />
  );
}