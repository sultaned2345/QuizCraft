// components/RichTextEditor.tsx
'use client';

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
    onClick: () => void; // <-- THIS LINE IS FIXED
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
        class:
          'prose prose-sm dark:prose-invert max-w-none p-4 h-full min-h-[300px] rounded-b-md border border-t-0 focus:outline-none',
      },
    },
    onUpdate({ editor }) {
      // We output HTML, so MarkdownViewer must be updated to handle HTML
      // Or we configure tiptap to output markdown (more complex)
      // For now, let's stick to HTML output for simplicity.
      onChange(editor.getHTML());
    },
  });

  React.useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Update editor content if the note prop changes (e.g., loading)
  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content, false);
    }
  }, [content, editor]);

  return (
    <div className={cn('rounded-md border', className)}>
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}