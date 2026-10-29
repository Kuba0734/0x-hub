import { useState, type ReactNode } from "react";
import { GlassSelect, GlassTextarea } from "@/components/glass";
import { formatBytes, formatDateTime } from "@/lib/format";
import type { DocumentItem, DocumentPatch } from "@/lib/ipc";
import { strings } from "@/lib/strings";
import { flatten, type FolderTree } from "../folders/folderTree";
import { ExpiryEditor } from "./ExpiryEditor";
import { LinkedNotes } from "./LinkedNotes";
import { OcrSection } from "./OcrSection";
import { TagEditor } from "./TagEditor";

const s = strings.documents;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[12px] text-fg-2">{label}</span>
      {children}
    </div>
  );
}

interface Props {
  doc: DocumentItem;
  tree: FolderTree;
  onPatch: (patch: DocumentPatch) => void;
}

export function MetaPanel({ doc, tree, onPatch }: Props) {
  const [description, setDescription] = useState(doc.description);

  return (
    <div className="flex flex-col gap-6">
      <Field label={s.folder}>
        <GlassSelect<string>
          label={s.folder}
          value={doc.folderId ?? ""}
          onChange={(v) => onPatch({ folderId: v })}
          options={[
            { value: "", label: s.folders.topLevel },
            // Indented tree; non-breaking spaces survive in the option labels.
            ...flatten(tree).map(({ folder, depth }) => ({
              value: folder.id,
              label: `${"\u00a0\u00a0\u00a0".repeat(depth)}${folder.name}`,
            })),
          ]}
          className="w-full"
        />
      </Field>
      <Field label={s.tags}>
        <TagEditor tags={doc.tags} onChange={(tags) => onPatch({ tags })} />
      </Field>
      <Field label={s.expiry}>
        <ExpiryEditor
          expiresOn={doc.expiresOn}
          offsets={doc.reminderOffsets}
          onDate={(expiresOn) => onPatch({ expiresOn })}
          onOffsets={(reminderOffsets) => onPatch({ reminderOffsets })}
        />
      </Field>
      <GlassTextarea
        label={s.description}
        placeholder={s.descriptionPlaceholder}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onBlur={() => description !== doc.description && onPatch({ description })}
      />
      <OcrSection doc={doc} />
      <LinkedNotes doc={doc} />
      <section className="flex flex-col gap-1.5 border-t border-line pt-4 text-[12px]">
        <h3 className="mb-1 text-[13px] font-medium tracking-normal text-fg-2">{s.details}</h3>
        {[
          [s.file, doc.filename],
          [s.type, s.kinds[doc.kind] ?? doc.kind],
          [s.size, formatBytes(doc.size)],
          [s.added, formatDateTime(doc.createdAt)],
          [s.modified, formatDateTime(doc.updatedAt)],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4">
            <span className="text-fg-3">{k}</span>
            <span className="truncate text-right text-fg-2 select-text">{v}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
