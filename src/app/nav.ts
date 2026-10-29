import { FileText, FlaskConical, LayoutGrid, NotebookPen, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { strings } from "@/lib/strings";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { path: "/", label: strings.nav.overview, icon: LayoutGrid },
  { path: "/documents", label: strings.nav.documents, icon: FileText },
  { path: "/notes", label: strings.nav.notes, icon: NotebookPen },
  { path: "/settings", label: strings.nav.settings, icon: Settings },
];

/** Hidden dev-only route. */
export const playgroundItem: NavItem = {
  path: "/playground",
  label: strings.nav.playground,
  icon: FlaskConical,
};

/** Route order used for direction-aware page transitions. */
export const routeOrder = [...navItems.map((n) => n.path), playgroundItem.path];

/** "/documents/abc" → "/documents" */
export function sectionOf(pathname: string): string {
  const first = pathname.split("/")[1];
  return first ? `/${first}` : "/";
}
