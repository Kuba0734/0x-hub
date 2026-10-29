import { useState } from "react";
import { ChevronDown, EyeOff, FilePen, PenLine, Wrench } from "lucide-react";
import { GlassButton, GlassMenu, type MenuItem } from "@/components/glass";
import type { DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { PdfEditorDialog } from "../pdf/PdfEditorDialog";
import { RedactDialog } from "../redact/RedactDialog";

const s = strings.pdfTools;

type Tool = "pages" | "sign" | "redact";

/** "Tools" menu on the document page: edit/sign PDFs, redacted export of PDFs and images. */
export function DocumentTools({ doc }: { doc: DocumentItem }) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [tool, setTool] = useState<Tool | null>(null);
  if (doc.kind !== "pdf" && doc.kind !== "image") return null;

  const items: MenuItem[] = [
    ...(doc.kind === "pdf"
      ? [
          { label: s.editPdf, icon: <FilePen />, onSelect: () => setTool("pages") },
          { label: s.sign, icon: <PenLine />, onSelect: () => setTool("sign") },
        ]
      : []),
    { label: strings.redact.action, icon: <EyeOff />, onSelect: () => setTool("redact") },
  ];

  return (
    <>
      <GlassButton
        size="sm"
        icon={<Wrench />}
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMenu({ x: r.left, y: r.bottom + 6 });
        }}
      >
        {s.tools}
        <ChevronDown className="h-3.5 w-3.5 text-fg-3" />
      </GlassButton>
      <GlassMenu items={items} position={menu} onClose={() => setMenu(null)} label={s.tools} />
      {doc.kind === "pdf" && (
        <PdfEditorDialog
          doc={doc}
          open={tool === "pages" || tool === "sign"}
          mode={tool === "sign" ? "sign" : "pages"}
          onClose={() => setTool(null)}
        />
      )}
      <RedactDialog doc={doc} open={tool === "redact"} onClose={() => setTool(null)} />
    </>
  );
}
