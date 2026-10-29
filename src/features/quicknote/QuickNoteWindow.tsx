import { useEffect, useRef, useState } from "react";
import { Lock } from "lucide-react";
import { GlassButton } from "@/components/glass";
import { Kbd } from "@/components/ui/Kbd";
import { PopupFrame } from "@/components/ui/PopupFrame";
import { ipc, toIpcError } from "@/lib/ipc";
import { win } from "@/lib/platform";
import { strings } from "@/lib/strings";

const s = strings.quickNote;

/** Global-hotkey popup: jot something down, Ctrl+Enter saves it as a sticky note. */
export function QuickNoteWindow() {
  const [text, setText] = useState("");
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const check = () =>
      void ipc.vault.status().then(
        (st) => setLocked(!st.unlocked),
        () => setLocked(true),
      );
    check();
    window.addEventListener("focus", check);
    return () => window.removeEventListener("focus", check);
  }, []);

  const hide = () => {
    setText("");
    setSaved(false);
    void win.hide();
  };

  const save = async () => {
    const body = text.trim();
    if (!body) return;
    try {
      const [first = "", ...rest] = body.split("\n");
      const title = first.length <= 60 && rest.length > 0 ? first : "";
      const content = title ? rest.join("\n").trim() : body;
      await ipc.notes.create("sticky", { title, content, plain: content });
      setSaved(true);
      window.setTimeout(hide, 600);
    } catch (e) {
      const err = toIpcError(e);
      if (err.code === "locked") setLocked(true);
      else setError(err.message);
    }
  };

  if (locked)
    return (
      <PopupFrame title={s.title} onClose={hide}>
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
          <Lock className="h-5 w-5 text-fg-2" />
          <p className="text-[13px] text-fg-2">{s.locked}</p>
          <GlassButton size="sm" onClick={() => void ipc.app.showMain().then(hide)}>
            {s.openApp}
          </GlassButton>
        </div>
      </PopupFrame>
    );

  return (
    <PopupFrame title={s.title} onClose={hide}>
      <div className="flex h-full flex-col px-3.5 pb-3">
        <textarea
          ref={area}
          aria-label={s.placeholder}
          placeholder={s.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey) {
              e.preventDefault();
              void save();
            } else if (e.key === "Escape") hide();
          }}
          className="min-h-0 flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-fg placeholder:text-fg-3 focus-visible:outline-none"
          autoFocus
        />
        {error && (
          <p role="alert" className="mb-2 text-[12px] font-medium">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2">
          <span className="text-[11px] text-fg-3" aria-live="polite">
            {saved ? s.saved : <Kbd>{s.saveHint}</Kbd>}
          </span>
          <GlassButton
            size="sm"
            variant="primary"
            disabled={!text.trim()}
            onClick={() => void save()}
          >
            {s.save}
          </GlassButton>
        </div>
      </div>
    </PopupFrame>
  );
}
