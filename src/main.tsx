import "./styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Providers } from "@/app/Providers";
import { App } from "@/app/App";
import { QuickNoteWindow } from "@/features/quicknote/QuickNoteWindow";
import { StickyWindow } from "@/features/notes/sticky/StickyWindow";
import { inTauri } from "@/lib/ipc";
import { windowLabel } from "@/lib/platform";

if (!inTauri()) {
  document.documentElement.classList.add("no-vibrancy");
  // Dev-only fake backend for reviewing the UI in a browser; stripped from production builds.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("mock")) {
    const { installMockBackend } = await import("@/dev/mockBackend");
    installMockBackend();
  }
}

const label = windowLabel();

function Root() {
  if (label === "quicknote") return <QuickNoteWindow />;
  if (label.startsWith("sticky-")) return <StickyWindow noteId={label.slice("sticky-".length)} />;
  return <App />;
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <StrictMode>
      <Providers>
        <Root />
      </Providers>
    </StrictMode>,
  );
}
