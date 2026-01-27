'use client';

import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Mermaid } from '@/components/ui/Mermaid';

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

  return (
    <div
      className={cn(
        'prose prose-zinc dark:prose-invert max-w-none break-words',
        // Typography overrides
        'prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl',
        'prose-headings:tracking-tight',
        'prose-p:leading-8 prose-p:text-zinc-700 dark:prose-p:text-zinc-300',
        'prose-li:marker:text-zinc-400',
        'prose-blockquote:border-l-4 prose-blockquote:border-primary/30 prose-blockquote:bg-muted/20 prose-blockquote:px-4 prose-blockquote:py-1 prose-blockquote:rounded-r prose-blockquote:font-normal prose-blockquote:not-italic',
        // Code styling
        'prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:bg-zinc-100 dark:prose-code:bg-zinc-800 prose-code:text-zinc-900 dark:prose-code:text-zinc-100 prose-code:before:content-none prose-code:after:content-none',
        // Table custom styling override (prose default is sometimes weak)
        'prose-table:overflow-hidden prose-table:border prose-table:border-zinc-200 dark:prose-table:border-zinc-700 prose-table:rounded-lg prose-table:shadow-sm',
        'prose-th:bg-zinc-100/50 dark:prose-th:bg-zinc-800/50 prose-th:p-4',
        'prose-td:p-4',
        className
      )}
      onMouseUpCapture={onMouseUpCapture}
    >
      <ReactMarkdown 
        remarkPlugins={[remarkGfm]}
        components={{
          // Override code block rendering to detect Mermaid
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const isMermaid = match && match[1] === 'mermaid';

            if (!inline && isMermaid) {
              return <Mermaid chart={String(children).replace(/\n$/, '')} />;
            }

            return !inline && match ? (
              <pre className={cn("rounded-lg bg-zinc-950 p-4 overflow-x-auto", className)}>
                 <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // Custom Table Rendering for that "Rich" feel
          table({ children }) {
            return (
              <div className="my-6 w-full overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm">
                <table className="w-full text-sm text-left">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium border-b border-zinc-200 dark:border-zinc-800">{children}</thead>;
          },
          tr({ children }) {
            return <tr className="border-b border-zinc-100 dark:border-zinc-800 last:border-0 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/50 transition-colors">{children}</tr>;
          },
          td({ children }) {
            return <td className="p-4 align-top text-zinc-600 dark:text-zinc-300">{children}</td>;
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}