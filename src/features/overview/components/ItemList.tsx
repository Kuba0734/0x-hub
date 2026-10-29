import { useNavigate } from "react-router";
import { relativeTime } from "@/lib/format";
import { strings } from "@/lib/strings";
import { KindIcon } from "@/features/documents/components/Thumbnail";
import { noteIcon } from "@/features/notes/noteIcons";
import type { Item } from "../overviewData";

export function ItemList({ items, empty }: { items: Item[]; empty: string }) {
  const navigate = useNavigate();
  if (!items.length) return <p className="py-6 text-center text-[13px] text-fg-3">{empty}</p>;
  return (
    <ul className="flex flex-col">
      {items.map((i) => {
        const Icon = i.type === "note" ? noteIcon[i.note.kind] : null;
        return (
          <li key={`${i.type}-${i.id}`}>
            <button
              type="button"
              onClick={() =>
                navigate(i.type === "document" ? `/documents/${i.id}` : `/notes/${i.id}`)
              }
              className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-white/[0.05]"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-fg-2">
                {Icon ? (
                  <Icon className="h-4 w-4" />
                ) : (
                  i.type === "document" && <KindIcon kind={i.doc.kind} className="h-4 w-4" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-fg">
                  {i.title || strings.common.untitled}
                </span>
                <span className="block text-[11px] text-fg-3">
                  {i.type === "document"
                    ? strings.documents.kinds[i.doc.kind]
                    : strings.notes.types[i.note.kind]}{" "}
                  · {relativeTime(i.updatedAt)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
