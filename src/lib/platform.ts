/** Thin wrappers over Tauri plugin JS APIs (window, dialogs, drag & drop, updater, relaunch). */
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open, save } from "@tauri-apps/plugin-dialog";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type { Update };

export function windowLabel(): string {
  return isTauri() ? getCurrentWindow().label : "main";
}

export const win = {
  minimize: () => getCurrentWindow().minimize(),
  toggleMaximize: () => getCurrentWindow().toggleMaximize(),
  isMaximized: () => getCurrentWindow().isMaximized(),
  close: () => getCurrentWindow().close(),
  hide: () => getCurrentWindow().hide(),
  onResized: (fn: () => void) => getCurrentWindow().onResized(fn),
};

export const dialogs = {
  pickFiles: async (): Promise<string[]> => {
    const r = await open({ multiple: true, directory: false });
    if (!r) return [];
    return Array.isArray(r) ? r : [r];
  },
  pickFolder: async (): Promise<string | null> => {
    const r = await open({ directory: true, multiple: false });
    return typeof r === "string" ? r : null;
  },
  pickBackup: async (): Promise<string | null> => {
    const r = await open({
      multiple: false,
      filters: [{ name: "0x-hub backup", extensions: ["0xbackup"] }],
    });
    return typeof r === "string" ? r : null;
  },
  saveFile: (defaultPath: string, filters?: { name: string; extensions: string[] }[]) =>
    save({ defaultPath, filters }),
};

export type DragDropPayload =
  | { type: "enter"; paths: string[]; x: number; y: number }
  | { type: "over"; x: number; y: number }
  | { type: "drop"; paths: string[]; x: number; y: number }
  | { type: "leave" };

/** Native file drag & drop on the current webview. Positions are in CSS pixels. */
export function onFileDrop(handler: (p: DragDropPayload) => void): () => void {
  if (!isTauri()) return () => {};
  let unlisten: (() => void) | null = null;
  let cancelled = false;
  void getCurrentWebview()
    .onDragDropEvent((event) => {
      const p = event.payload;
      const scale = window.devicePixelRatio || 1;
      if (p.type === "leave") return handler({ type: "leave" });
      const x = p.position.x / scale;
      const y = p.position.y / scale;
      if (p.type === "over") handler({ type: "over", x, y });
      else handler({ type: p.type, paths: p.paths, x, y });
    })
    .then((fn) => {
      if (cancelled) fn();
      else unlisten = fn;
    });
  return () => {
    cancelled = true;
    unlisten?.();
  };
}

export const updater = {
  check: () => check(),
  relaunch: () => relaunch(),
};
