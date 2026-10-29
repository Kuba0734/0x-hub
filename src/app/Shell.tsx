import { AnimatePresence } from "motion/react";
import { useState } from "react";
import { Route, Routes, useLocation } from "react-router";
import { PageTransition, routeDirection } from "@/components/motion";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { DocumentsPage } from "@/features/documents/DocumentsPage";
import { DocumentDetailPage } from "@/features/documents/detail/DocumentDetailPage";
import { NotesPage } from "@/features/notes/NotesPage";
import { NoteEditorPage } from "@/features/notes/editor/NoteEditorPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { PlaygroundPage } from "@/features/playground/PlaygroundPage";
import { CommandPalette } from "@/features/search/CommandPalette";
import { UpdateDialog } from "@/features/settings/updates/UpdateDialog";
import { useSession } from "@/stores/session";
import { routeOrder, sectionOf } from "./nav";
import { Sidebar } from "./Sidebar";
import { TitleBar } from "./TitleBar";
import { useExternalImports } from "./useExternalImports";

function Pages() {
  const location = useLocation();
  const section = sectionOf(location.pathname);
  // Derived from the previous render: which way did we move through the sidebar order?
  const [nav, setNav] = useState({ section, dir: 1 });
  if (nav.section !== section) {
    setNav({ section, dir: routeDirection(routeOrder, nav.section, section) });
  }
  const dir = nav.dir;

  return (
    // popLayout: the new page enters while the old one fades out on top, without a gap.
    <AnimatePresence mode="popLayout" custom={dir} initial={false}>
      <PageTransition key={location.pathname} direction={dir} className="h-full">
        <Routes location={location}>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/:id" element={<DocumentDetailPage />} />
          <Route path="/notes" element={<NotesPage />} />
          <Route path="/notes/:id" element={<NoteEditorPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/:section" element={<SettingsPage />} />
          {import.meta.env.DEV && <Route path="/playground" element={<PlaygroundPage />} />}
          <Route path="*" element={<OverviewPage />} />
        </Routes>
      </PageTransition>
    </AnimatePresence>
  );
}

/** Title bar + sidebar + routed content. Content is not rendered while locked. */
export function Shell() {
  const unlocked = useSession((s) => s.phase === "unlocked");
  useExternalImports();
  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="relative min-w-0 flex-1 overflow-hidden">{unlocked && <Pages />}</main>
      </div>
      {unlocked && <CommandPalette />}
      {unlocked && <UpdateDialog />}
    </div>
  );
}
