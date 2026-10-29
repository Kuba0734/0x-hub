/**
 * Typed wrappers around Tauri IPC. This is the ONLY module that calls `invoke()`.
 * Types mirror the Rust structs in src-tauri/src (serde camelCase).
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

// ---------- Errors ----------

export type ErrorCode =
  | "locked"
  | "not_initialized"
  | "already_initialized"
  | "wrong_password"
  | "backoff"
  | "not_found"
  | "document_locked"
  | "invalid"
  | "hello_unavailable"
  | "hello_cancelled"
  | "crypto"
  | "db"
  | "io"
  | "data"
  | "backup"
  | "windows"
  | "app"
  | "unknown";

export class IpcError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = "IpcError";
  }
}

interface RawError {
  code?: string;
  message?: string;
  retryAfterMs?: number | null;
}

export function toIpcError(e: unknown): IpcError {
  if (e instanceof IpcError) return e;
  if (e && typeof e === "object" && "code" in e) {
    const r = e as RawError;
    return new IpcError(
      (r.code ?? "unknown") as ErrorCode,
      r.message ?? "",
      r.retryAfterMs ?? null,
    );
  }
  return new IpcError("unknown", typeof e === "string" ? e : String(e));
}

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (e) {
    throw toIpcError(e);
  }
}

export const inTauri = (): boolean => isTauri();

// ---------- Types ----------

export interface VaultStatus {
  initialized: boolean;
  unlocked: boolean;
  helloEnabled: boolean;
  retryAfterMs: number;
}

export type DocumentKind = "pdf" | "image" | "office" | "text" | "generic";
export type OcrStatus = "none" | "pending" | "running" | "done" | "failed";

export interface DocumentItem {
  id: string;
  title: string;
  filename: string;
  mime: string;
  kind: DocumentKind;
  size: number;
  categoryId: string | null;
  tags: string[];
  description: string;
  expiresOn: string | null;
  reminderOffsets: number[];
  pinned: boolean;
  ocrStatus: OcrStatus;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  linkedNoteIds: string[];
  /** Content requires re-confirming identity (password or Windows Hello). */
  locked: boolean;
  /** Locked but re-confirmed in the last few minutes. */
  revealed: boolean;
}

/** Empty string for `categoryId` / `expiresOn` clears the value. */
export interface DocumentPatch {
  title?: string;
  categoryId?: string;
  tags?: string[];
  description?: string;
  expiresOn?: string;
  reminderOffsets?: number[];
  pinned?: boolean;
  locked?: boolean;
}

export interface Category {
  id: string;
  name: string;
  sort: number;
  documentCount: number;
}

export interface ImportResult {
  imported: string[];
  failed: { name: string; message: string }[];
}

export type NoteKind = "markdown" | "checklist" | "sticky";

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface NoteData {
  title: string;
  content: string;
  plain: string;
  items: ChecklistItem[];
}

export interface Note extends NoteData {
  id: string;
  kind: NoteKind;
  shade: number;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  linkedDocumentIds: string[];
}

export type NotePatch = Partial<NoteData> & { shade?: number; pinned?: boolean };

export interface SearchHit {
  kind: "document" | "note";
  id: string;
  title: string;
  snippet: string;
  subKind: string;
}

export interface AutoBackup {
  enabled: boolean;
  folder: string | null;
  intervalDays: number;
  lastRunAt: number | null;
}

export interface AppSettings {
  autoLockMinutes: number;
  lockOnSessionLock: boolean;
  closeToTray: boolean;
  reduceMotion: boolean | null;
  glassIntensity: number;
  sidebarCollapsed: boolean;
  notificationsEnabled: boolean;
  defaultReminderOffsets: number[];
  hotkey: string;
  autostart: boolean;
  autoBackup: AutoBackup;
  skipVersion: string | null;
  blurPreviews: boolean;
  explorerIntegration: boolean;
}

export type SettingsPatch = Partial<Omit<AppSettings, "autoBackup">> & {
  autoBackup?: Partial<AutoBackup>;
};

export interface OverviewStats {
  documents: number;
  notes: number;
  storageBytes: number;
  expiringSoon: number;
}

export interface AppInfo {
  version: string;
  dataDir: string;
}

// ---------- Commands ----------

export const ipc = {
  app: {
    info: () => call<AppInfo>("app_info"),
    touch: () => call<void>("touch_activity"),
    overview: () => call<OverviewStats>("overview_stats"),
    openQuickNote: () => call<void>("open_quick_note"),
    openSticky: (noteId: string) => call<void>("open_sticky_window", { noteId }),
    showMain: () => call<void>("show_main_window"),
    takePendingImports: () => call<string[]>("take_pending_imports"),
    saveTextFile: (path: string, contents: string) =>
      call<void>("save_text_file", { path, contents }),
  },
  vault: {
    status: () => call<VaultStatus>("vault_status"),
    setup: (password: string) => call<string>("vault_setup", { password }),
    unlock: (password: string) => call<void>("vault_unlock", { password }),
    recover: (recoveryKey: string, newPassword: string) =>
      call<void>("vault_recover", { recoveryKey, newPassword }),
    lock: () => call<void>("vault_lock"),
    changePassword: (current: string, next: string) =>
      call<void>("vault_change_password", { current, next }),
  },
  hello: {
    available: () => call<boolean>("hello_available"),
    enable: () => call<void>("hello_enable"),
    disable: () => call<void>("hello_disable"),
    unlock: () => call<void>("hello_unlock"),
  },
  documents: {
    list: (trashed = false) => call<DocumentItem[]>("documents_list", { trashed }),
    get: (id: string) => call<DocumentItem>("document_get", { id }),
    import: (paths: string[], categoryId?: string | null) =>
      call<ImportResult>("documents_import", { paths, categoryId: categoryId ?? null }),
    update: (id: string, patch: DocumentPatch) =>
      call<DocumentItem>("document_update", { id, patch }),
    trash: (id: string) => call<void>("document_trash", { id }),
    restore: (id: string) => call<void>("document_restore", { id }),
    deleteForever: (id: string) => call<void>("document_delete_forever", { id }),
    content: (id: string) => call<ArrayBuffer>("document_content", { id }),
    /** Upright JPEG for images the WebView can't decode (HEIC/HEIF/TIFF). */
    previewImage: (id: string, max: number) =>
      call<ArrayBuffer>("document_preview_image", { id, max }),
    ocrText: (id: string) => call<string | null>("document_ocr_text", { id }),
    rerunOcr: (id: string) => call<void>("document_rerun_ocr", { id }),
    export: (id: string, target: string) => call<void>("document_export", { id, target }),
    openExternal: (id: string) => call<void>("document_open_external", { id }),
    exportMany: (ids: string[], folder: string) =>
      call<{ exported: number; skipped: string[] }>("documents_export_many", { ids, folder }),
    /** Opens a locked document for a few minutes. Without a password: Windows Hello. */
    reveal: (id: string, password?: string) =>
      call<void>("document_reveal", { id, password: password ?? null }),
  },
  categories: {
    list: () => call<Category[]>("categories_list"),
    create: (name: string) => call<Category>("category_create", { name }),
    rename: (id: string, name: string) => call<void>("category_rename", { id, name }),
    delete: (id: string) => call<void>("category_delete", { id }),
  },
  notes: {
    list: (trashed = false) => call<Note[]>("notes_list", { trashed }),
    get: (id: string) => call<Note>("note_get", { id }),
    create: (kind: NoteKind, data?: Partial<NoteData>) =>
      call<Note>("note_create", {
        kind,
        data: data ? { title: "", content: "", plain: "", items: [], ...data } : null,
      }),
    update: (id: string, patch: NotePatch) => call<Note>("note_update", { id, patch }),
    trash: (id: string) => call<void>("note_trash", { id }),
    restore: (id: string) => call<void>("note_restore", { id }),
    deleteForever: (id: string) => call<void>("note_delete_forever", { id }),
    link: (noteId: string, documentId: string) => call<void>("link_create", { noteId, documentId }),
    unlink: (noteId: string, documentId: string) =>
      call<void>("link_delete", { noteId, documentId }),
  },
  search: (query: string) => call<SearchHit[]>("search_all", { query }),
  settings: {
    get: () => call<AppSettings>("settings_get"),
    update: (patch: SettingsPatch) => call<AppSettings>("settings_update", { patch }),
  },
  backup: {
    export: (target: string) => call<void>("backup_export", { target }),
    import: (source: string, password: string) => call<void>("backup_import", { source, password }),
    runAuto: () => call<string | null>("backup_run_auto"),
  },
};

// ---------- Events ----------

export interface ImportProgress {
  done: number;
  total: number;
  name: string;
}

export interface OcrProgress {
  documentId: string;
  done: number;
  total: number;
  status: OcrStatus;
}

interface EventMap {
  "vault://locked": string;
  "vault://unlocked": null;
  "vault://restored": null;
  "progress://import": ImportProgress;
  "progress://ocr": OcrProgress;
  "documents://changed": null;
  "notes://changed": string;
  "updates://check": null;
  "import://requested": null;
}

export type AppEvent = keyof EventMap;

/** Subscribes to a backend event. Returns an unsubscribe function; a no-op outside Tauri. */
export function onEvent<E extends AppEvent>(
  event: E,
  handler: (payload: EventMap[E]) => void,
): () => void {
  if (!isTauri()) return () => {};
  let unlisten: UnlistenFn | null = null;
  let cancelled = false;
  void listen<EventMap[E]>(event, (e) => handler(e.payload)).then((fn) => {
    if (cancelled) fn();
    else unlisten = fn;
  });
  return () => {
    cancelled = true;
    unlisten?.();
  };
}
