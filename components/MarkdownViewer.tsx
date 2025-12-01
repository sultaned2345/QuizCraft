// components/MarkdownViewer.tsx
'use client';

import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownViewerProps {
  content: string;
  className?: string;
  onMouseUpCapture?: (e: React.MouseEvent) => void;
}

export function MarkdownViewer({
  content,
  className,
  onMouseUpCapture,
}: MarkdownViewerProps) {
  // Check if content looks like HTML (legacy support for rich text notes)
  const isHtml = /<([a-z]+)([^<]+)*(?:>(.*)<\/\1>|\s+\/>)/i.test(content);

  if (isHtml) {
    return (
      <div
        className={cn(
          'prose prose-sm dark:prose-invert max-w-none break-words',
          'prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl',
          'prose-p:leading-7',
          className
        )}
        dangerouslySetInnerHTML={{ __html: content }}
        onMouseUpCapture={onMouseUpCapture}
      />
    );
  }

  // Standard Markdown Rendering
  return (
    <div
      className={cn(
        // UPGRADE: Changed from prose-zinc to prose-slate for better contrast
        'prose prose-slate dark:prose-invert max-w-none break-words',
        // Typography Overrides for "Paper" feel
        'prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl',
        'prose-headings:tracking-tight',
        // UPGRADE: Increased line-height to leading-8 for better readability
        'prose-p:leading-8 prose-p:text-slate-700 dark:prose-p:text-slate-300', 
        'prose-li:marker:text-slate-400',
        'prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:bg-muted/20 prose-blockquote:px-4 prose-blockquote:py-1 prose-blockquote:rounded-r prose-blockquote:font-normal prose-blockquote:not-italic',
        'prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-slate-100 dark:prose-code:bg-slate-800 prose-code:text-slate-900 dark:prose-code:text-slate-100 prose-code:before:content-none prose-code:after:content-none',
        className
      )}
      onMouseUpCapture={onMouseUpCapture}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}