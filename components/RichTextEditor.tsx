'use client';

import * as React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { cn } from '@/lib/utils';
import { 
  Bold, 
  Italic, 
  Strikethrough, 
  Heading1, 
  Heading2, 
  Heading3, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Eye, 
  EyeOff,
  Highlighter
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onHeadersUpdate?: (headers: { id: string; text: string; level: number }[]) => void;
  isStudyMode?: boolean;
  editable?: boolean;
  className?: string;
}

// --- Custom Toolbar ---
const Toolbar = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  const ToggleButton = ({ onClick, isActive, icon: Icon, label, className }: any) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        'h-8 w-8 p-0 hover:bg-muted text-muted-foreground',
        isActive && 'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary',
        className
      )}
      title={label}
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only">{label}</span>
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30 sticky top-0 z-10 backdrop-blur-sm">
      <ToggleButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        icon={Bold}
        label="Bold"
      />
      <ToggleButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        icon={Italic}
        label="Italic"
      />
      <ToggleButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        icon={Strikethrough}
        label="Strikethrough"
      />
      
      <div className="w-px h-4 bg-border mx-1" />
      
      {/* Cloze / Highlight Button */}
      <ToggleButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        icon={Highlighter}
        label="Mark for Study (Cloze)"
        className={editor.isActive('highlight') ? "text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400" : ""}
      />

      <div className="w-px h-4 bg-border mx-1" />

      <ToggleButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        icon={Heading1}
        label="H1"
      />
      <ToggleButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        icon={Heading2}
        label="H2"
      />
      <ToggleButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
        icon={Heading3}
        label="H3"
      />
      
      <div className="w-px h-4 bg-border mx-1" />

      <ToggleButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        icon={List}
        label="Bullet List"
      />
      <ToggleButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        icon={ListOrdered}
        label="Ordered List"
      />
      <ToggleButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        icon={Quote}
        label="Quote"
      />
      <ToggleButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        icon={Code}
        label="Code Block"
      />
    </div>
  );
};

export function RichTextEditor({
  content,
  onChange,
  onHeadersUpdate,
  isStudyMode = false,
  editable = true,
  className,
}: RichTextEditorProps) {
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Highlight.configure({
        multicolor: false,
        HTMLAttributes: {
          class: 'study-highlight', // Class for targeting in CSS
        },
      }),
    ],
    content: content,
    editable: editable,
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-zinc dark:prose-invert max-w-none',
          'prose-headings:font-semibold prose-headings:tracking-tight prose-headings:scroll-mt-20',
          'prose-p:leading-7',
          'prose-blockquote:border-l-4 prose-blockquote:border-primary/50 prose-blockquote:pl-4 prose-blockquote:italic',
          'prose-pre:bg-zinc-900 prose-pre:text-zinc-50 prose-pre:border prose-pre:border-zinc-800',
          'min-h-[400px] p-6 focus:outline-none'
        ),
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
      extractHeaders(editor);
    },
    onCreate({ editor }) {
      extractHeaders(editor);
    },
  });

  // Extract H1-H3 for TOC
  const extractHeaders = (editor: any) => {
    if (!onHeadersUpdate) return;
    const headers: { id: string; text: string; level: number }[] = [];
    
    // Simple traversal of JSON output to find headers
    editor.getJSON().content?.forEach((node: any) => {
      if (node.type === 'heading' && node.content) {
        const text = node.content[0].text;
        // Generate a simple ID
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        headers.push({ id, text, level: node.attrs.level });
      }
    });
    onHeadersUpdate(headers);
  };

  // Sync content externally
  React.useEffect(() => {
    if (editor && content && editor.getHTML() !== content) {
      if (editor.getText() === '') {
        editor.commands.setContent(content);
      }
    }
  }, [content, editor]);

  React.useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  return (
    <div className={cn(
      'flex flex-col rounded-xl border bg-card shadow-sm overflow-hidden transition-all duration-300',
      isStudyMode ? 'ring-2 ring-yellow-500/50 shadow-yellow-500/10' : '',
      className
    )}>
      
      {/* Dynamic CSS for Study Mode Cloze Deletion */}
      <style jsx global>{`
        /* Standard Highlight (Editor Mode) */
        mark.study-highlight {
          background-color: rgba(250, 204, 21, 0.3);
          color: inherit;
          padding: 2px 4px;
          border-radius: 4px;
        }

        /* Active Study Mode (Cloze Deletion) */
        .study-mode-active mark.study-highlight {
          background-color: #1a1a1a;
          color: transparent;
          cursor: pointer;
          user-select: none;
          transition: all 0.2s ease;
          border: 1px solid #333;
        }
        
        .dark .study-mode-active mark.study-highlight {
           background-color: #e4e4e7; /* Light block in dark mode */
        }

        /* Hover/Click to Reveal */
        .study-mode-active mark.study-highlight:hover,
        .study-mode-active mark.study-highlight:active {
          background-color: rgba(250, 204, 21, 0.3);
          color: inherit;
        }
      `}</style>

      {editable && !isStudyMode && <Toolbar editor={editor} />}
      
      <div className={cn("flex-1 bg-card", isStudyMode ? "study-mode-active" : "")}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}