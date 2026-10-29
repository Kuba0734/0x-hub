import { Command } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import { Search } from "lucide-react";
import { GlassFrost, GlassSurface } from "@/components/glass";
import { scaleIn, tween } from "@/components/motion/presets";
import { Kbd } from "@/components/ui/Kbd";
import { parseSnippet } from "@/lib/format";
import { strings } from "@/lib/strings";
import { useUi } from "@/stores/ui";
import { KindIcon } from "@/features/documents/components/Thumbnail";
import { noteIcon } from "@/features/notes/noteIcons";
import type { DocumentKind, NoteKind, SearchHit } from "@/lib/ipc";
import { usePaletteActions } from "./usePaletteActions";
import { useSearch } from "./useSearch";

const s = strings.palette;
const itemClass =
  "flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-[13px] text-fg-2 data-[selected=true]:bg-white/[0.09] data-[selected=true]:text-fg [&_svg]:h-4 [&_svg]:w-4";

function HitIcon({ hit }: { hit: SearchHit }) {
  if (hit.kind === "note") {
    const Icon = noteIcon[hit.subKind as NoteKind] ?? noteIcon.markdown;
    return <Icon />;
  }
  return <KindIcon kind={hit.subKind as DocumentKind} />;
}

function Snippet({ text }: { text: string }) {
  return (
    <span className="block truncate text-[12px] text-fg-3">
      {parseSnippet(text).map((seg, i) =>
        seg.hit ? (
          <mark key={i} className="rounded-sm bg-white/20 px-0.5 font-medium text-fg">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </span>
  );
}

function PaletteBody({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const actions = usePaletteActions();
  const search = useSearch(query);
  const q = query.trim().toLowerCase();
  const matching = actions.filter(
    (a) => !q || `${a.label} ${a.keywords ?? ""}`.toLowerCase().includes(q),
  );
  const hits = q ? (search.data ?? []) : [];

  const run = (fn: () => void) => {
    onClose();
    fn();
  };

  return (
    <Command label={s.label} shouldFilter={false} loop className="flex max-h-[60vh] flex-col">
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search className="h-4 w-4 text-fg-3" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder={s.placeholder}
          autoFocus
          className="h-12 flex-1 bg-transparent text-[15px] text-fg placeholder:text-fg-3 focus-visible:outline-none"
        />
        <Kbd>Esc</Kbd>
      </div>
      <Command.List className="min-h-0 flex-1 overflow-y-auto p-2">
        <Command.Empty className="py-8 text-center text-[13px] text-fg-3">{s.empty}</Command.Empty>
        {hits.length > 0 && (
          <Command.Group
            heading={s.groups.results}
            className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-fg-3"
          >
            {hits.map((h) => (
              <Command.Item
                key={`${h.kind}-${h.id}`}
                value={`hit-${h.kind}-${h.id}`}
                onSelect={() =>
                  run(() =>
                    navigate(h.kind === "document" ? `/documents/${h.id}` : `/notes/${h.id}`),
                  )
                }
                className={itemClass}
              >
                <HitIcon hit={h} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-fg">
                    {h.title || strings.common.untitled}
                  </span>
                  {h.snippet && <Snippet text={h.snippet} />}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        {(["navigate", "actions"] as const).map((g) => {
          const list = matching.filter((a) => a.group === g);
          if (!list.length) return null;
          return (
            <Command.Group
              key={g}
              heading={s.groups[g]}
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:text-fg-3"
            >
              {list.map((a) => (
                <Command.Item
                  key={a.id}
                  value={a.id}
                  onSelect={() => run(a.run)}
                  className={itemClass}
                >
                  {a.icon}
                  <span>{a.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          );
        })}
      </Command.List>
    </Command>
  );
}

/** Ctrl+K: scale-in from 0.96 over a blurred backdrop. */
export function CommandPalette() {
  const open = useUi((st) => st.paletteOpen);
  const setOpen = useUi((st) => st.setPalette);
  const close = () => setOpen(false);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-[14vh]"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
        >
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tween.standard}
            onClick={close}
          >
            <GlassFrost blur={8} dim={0.4} />
          </motion.div>
          <GlassSurface
            refract
            solid
            radius={20}
            role="dialog"
            aria-modal="true"
            aria-label={s.label}
            variants={scaleIn}
            initial="hidden"
            animate="show"
            exit="exit"
            className="w-full max-w-[620px] overflow-hidden"
          >
            <PaletteBody onClose={close} />
          </GlassSurface>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
