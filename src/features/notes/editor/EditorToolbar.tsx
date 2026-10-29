import { useEditorState, type Editor } from "@tiptap/react";
import { useState, type ReactNode } from "react";
import { Bold, Code2, Heading2, Italic, Link2, List, ListChecks } from "lucide-react";
import { GlassButton, GlassDialog, GlassInput, GlassTooltip } from "@/components/glass";
import { cn } from "@/lib/format";
import { strings } from "@/lib/strings";

const s = strings.notes;

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <GlassTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg transition-colors [&>svg]:h-4 [&>svg]:w-4",
          active ? "bg-white/[0.14] text-fg" : "text-fg-2 hover:bg-white/[0.06] hover:text-fg",
        )}
      >
        {children}
      </button>
    </GlassTooltip>
  );
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      heading: e.isActive("heading", { level: 2 }),
      bullet: e.isActive("bulletList"),
      task: e.isActive("taskList"),
      code: e.isActive("codeBlock"),
      link: e.isActive("link"),
    }),
  });
  const chain = () => editor.chain().focus();

  const applyLink = () => {
    const href = url.trim();
    if (!href) chain().extendMarkRange("link").unsetLink().run();
    else if (/^(https?:|mailto:)/i.test(href))
      chain().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
  };

  return (
    <div
      role="toolbar"
      aria-label={s.title}
      className="flex items-center gap-0.5 border-b border-line px-4 py-1.5"
    >
      <ToolButton label={s.bold} active={st.bold} onClick={() => chain().toggleBold().run()}>
        <Bold />
      </ToolButton>
      <ToolButton label={s.italic} active={st.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic />
      </ToolButton>
      <ToolButton
        label={s.heading}
        active={st.heading}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 />
      </ToolButton>
      <ToolButton
        label={s.bulletList}
        active={st.bullet}
        onClick={() => chain().toggleBulletList().run()}
      >
        <List />
      </ToolButton>
      <ToolButton
        label={s.taskList}
        active={st.task}
        onClick={() => chain().toggleTaskList().run()}
      >
        <ListChecks />
      </ToolButton>
      <ToolButton label={s.code} active={st.code} onClick={() => chain().toggleCodeBlock().run()}>
        <Code2 />
      </ToolButton>
      <ToolButton
        label={s.link}
        active={st.link}
        onClick={() => {
          setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
          setLinkOpen(true);
        }}
      >
        <Link2 />
      </ToolButton>
      <GlassDialog
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title={s.link}
        width={400}
        footer={
          <>
            <GlassButton variant="ghost" onClick={() => setLinkOpen(false)}>
              {strings.common.cancel}
            </GlassButton>
            <GlassButton variant="primary" onClick={applyLink}>
              {strings.common.save}
            </GlassButton>
          </>
        }
      >
        <GlassInput
          label={s.linkPrompt}
          placeholder="https://"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyLink()}
          data-autofocus
        />
      </GlassDialog>
    </div>
  );
}
