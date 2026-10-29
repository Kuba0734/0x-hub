import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Placeholder } from "@tiptap/extension-placeholder";
import { strings } from "@/lib/strings";
import { EditorToolbar } from "./EditorToolbar";

interface Props {
  content: string;
  onChange: (html: string, plain: string) => void;
}

/** TipTap editor with Markdown shortcuts (# heading, - list, [ ] task, ``` code, **bold**). */
export function MarkdownEditor({ content, onChange }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: strings.notes.bodyPlaceholder }),
    ],
    content,
    editorProps: {
      attributes: { class: "prose-editor", "aria-label": strings.notes.title, spellcheck: "true" },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML(), e.getText({ blockSeparator: "\n" })),
  });

  return (
    <div className="flex h-full flex-col">
      {editor && <EditorToolbar editor={editor} />}
      <div
        className="min-h-0 flex-1 overflow-y-auto px-8 py-6"
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} className="mx-auto max-w-[720px]" />
      </div>
    </div>
  );
}
