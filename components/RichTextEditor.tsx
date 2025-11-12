// components/RichTextEditor.tsx
'use client';

import * as React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { cn } from '@/lib/utils';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  editable: boolean;
  className?: string;
}

// Simple toolbar
const Toolbar = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  const Button = ({
    onClick,
    isActive,
    children,
  }: {
    onClick: () => void;
    isActive: boolean;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-2 py-1 text-sm font-medium rounded-md',
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-transparent hover:bg-muted',
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 p-2 border-b rounded-t-md bg-background">
      <Button
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
      >
        Bold
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
      >
        Italic
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
      >
        Strike
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
      >
        H2
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        isActive={editor.isActive('heading', { level: 3 })}
      >
        H3
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
      >
        List
      </Button>
      <Button
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
      >
        Quote
      </Button>
    </div>
  );
};

export function RichTextEditor({
  content,
  onChange,
  editable,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: content,
    editable: editable,
    editorProps: {
      attributes: {
        // --- FIX: Apply prose classes here ---
        class:
          'prose prose-sm dark:prose-invert max-w-none p-4 h-full min-h-[300px] rounded-b-md border border-t-0 focus:outline-none',
        // --- END FIX ---
      },
    },
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  React.useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  return (
    // --- FIX: Apply base styles to the container ---
    <div className={cn('rounded-md border bg-background', className)}>
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
    // --- END FIX ---
  );
}