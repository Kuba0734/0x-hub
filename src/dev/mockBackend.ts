/**
 * DEV ONLY: an in-memory fake backend so the UI can be reviewed in a normal browser
 * (`pnpm dev`, then open http://localhost:1420/?mock=unlocked|locked|onboarding).
 * Never bundled into production builds (guarded by import.meta.env.DEV in main.tsx).
 */
import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import type { AppSettings, Category, DocumentItem, Note } from "@/lib/ipc";

const day = 86_400_000;
const now = Date.now();
const iso = (offsetDays: number) => {
  const d = new Date(now + offsetDays * day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const categories: Category[] = [
  "IDs",
  "Contracts",
  "Insurance",
  "Taxes",
  "Medical",
  "Finance",
  "Other",
].map((name, sort) => ({ id: name.toLowerCase(), name, sort, documentCount: 0 }));

const doc = (
  id: string,
  title: string,
  kind: DocumentItem["kind"],
  cat: string | null,
  extra: Partial<DocumentItem> = {},
): DocumentItem => ({
  id,
  title,
  filename: `${title.toLowerCase().replace(/\s+/g, "-")}.${kind === "image" ? "jpg" : kind === "office" ? "docx" : kind === "text" ? "txt" : "pdf"}`,
  mime: kind === "image" ? "image/jpeg" : "application/pdf",
  kind,
  size: 180_000 + id.length * 91_000,
  categoryId: cat,
  tags: [],
  description: "",
  expiresOn: null,
  reminderOffsets: [90, 30, 7, 1],
  pinned: false,
  ocrStatus: kind === "pdf" || kind === "image" ? "done" : "none",
  createdAt: now - 20 * day,
  updatedAt: now - id.length * 3_600_000,
  deletedAt: null,
  linkedNoteIds: [],
  locked: false,
  revealed: false,
  ...extra,
});

const documents: DocumentItem[] = [
  doc("d1", "Passport", "image", "ids", { expiresOn: iso(5), pinned: true, tags: ["travel"] }),
  doc("d22", "Car insurance policy", "pdf", "insurance", { expiresOn: iso(24) }),
  doc("d333", "Tax return 2025", "pdf", "taxes", { tags: ["2025"], locked: true }),
  doc("d4444", "Rental contract", "office", "contracts", { expiresOn: iso(200) }),
  doc("d55555", "Vaccination record", "pdf", "medical", { expiresOn: iso(-3) }),
  doc("d666666", "Wi-Fi password", "text", null),
  doc("d7777777", "Receipt photo", "image", "finance", {
    filename: "IMG_0042.HEIC",
    mime: "image/heic",
  }),
];

/** Stand-in for the backend's HEIC→JPEG rendition: a grey gradient JPEG. */
async function fakeJpeg(max: number): Promise<ArrayBuffer> {
  const c = document.createElement("canvas");
  c.width = Math.min(max, 1200);
  c.height = Math.round(c.width * 0.75);
  const g = c.getContext("2d")!;
  const grad = g.createLinearGradient(0, 0, c.width, c.height);
  grad.addColorStop(0, "#d9d9d9");
  grad.addColorStop(1, "#3a3a3a");
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.8));
  return blob.arrayBuffer();
}

const note = (
  id: string,
  kind: Note["kind"],
  title: string,
  plain: string,
  extra: Partial<Note> = {},
): Note => ({
  id,
  kind,
  title,
  content: kind === "markdown" ? `<p>${plain}</p>` : plain,
  plain,
  items: [],
  shade: 0,
  pinned: false,
  createdAt: now - 5 * day,
  updatedAt: now - id.length * 7_200_000,
  deletedAt: null,
  linkedDocumentIds: [],
  locked: false,
  revealed: false,
  ...extra,
});

const notes: Note[] = [
  note(
    "n1",
    "markdown",
    "Trip to Lisbon",
    "Flights booked. Remember to renew passport before May.",
    { pinned: true, shade: 2 },
  ),
  note("n22", "checklist", "Groceries", "", {
    items: [
      { id: "a", text: "Oat milk", done: true },
      { id: "b", text: "Coffee beans", done: false },
      { id: "c", text: "Bread", done: false },
    ],
  }),
  note("n333", "sticky", "", "Call the insurance about the windshield claim", { shade: 4 }),
  note("n4444", "markdown", "Bank PINs", "Card 1234, online banking 5678", { locked: true }),
];

let settings: AppSettings = {
  autoLockMinutes: 10,
  lockOnSessionLock: true,
  closeToTray: true,
  reduceMotion: null,
  glassIntensity: 1,
  sidebarCollapsed: false,
  notificationsEnabled: true,
  defaultReminderOffsets: [90, 30, 7, 1],
  hotkey: "Ctrl+Alt+Space",
  autostart: false,
  autoBackup: { enabled: false, folder: null, intervalDays: 7, lastRunAt: null },
  skipVersion: null,
  blurPreviews: true,
  explorerIntegration: false,
};

const hideLocked = (n: Note): Note =>
  n.locked && !n.revealed ? { ...n, content: "", plain: "", items: [] } : n;

export function installMockBackend() {
  const mode = new URLSearchParams(location.search).get("mock") ?? "unlocked";
  let initialized = mode !== "onboarding";
  let unlocked = mode === "unlocked";
  (window as unknown as { isTauri: boolean }).isTauri = true;
  mockWindows("main");

  // Like the real IPC bridge, hand out copies so callers never share mutable state with the mock.
  const copy = (v: unknown) =>
    v && typeof v === "object" && !(v instanceof ArrayBuffer) ? structuredClone(v) : v;
  mockIPC(
    async (cmd, payload) => copy(await handle(cmd, (payload ?? {}) as Record<string, unknown>)),
    { shouldMockEvents: true },
  );

  function handle(cmd: string, args: Record<string, unknown>): unknown {
    switch (cmd) {
      case "vault_status":
        return { initialized, unlocked, helloEnabled: false, retryAfterMs: 0 };
      case "vault_setup":
        initialized = unlocked = true;
        return "ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567-ABCD-EFGH-IJKL-MNOP-QRST";
      case "vault_unlock":
        unlocked = true;
        return null;
      case "vault_lock":
        unlocked = false;
        return null;
      case "hello_available":
        return false;
      case "settings_get":
        return settings;
      case "settings_update":
        settings = { ...settings, ...(args.patch as Partial<AppSettings>) };
        return settings;
      case "app_info":
        return { version: "0.1.0", dataDir: "C:\\Users\\you\\AppData\\Roaming\\0x-hub" };
      case "overview_stats":
        return {
          documents: documents.length,
          notes: notes.length,
          storageBytes: documents.reduce((a, d) => a + d.size, 0),
          expiringSoon: 2,
        };
      case "documents_list":
        return args.trashed ? [] : documents;
      case "document_get":
        return documents.find((d) => d.id === args.id);
      case "categories_list":
        return categories.map((c) => ({
          ...c,
          documentCount: documents.filter((d) => d.categoryId === c.id).length,
        }));
      case "notes_list":
        return args.trashed ? [] : notes.map(hideLocked);
      case "note_get": {
        const n = notes.find((x) => x.id === args.id);
        return n && hideLocked(n);
      }
      case "search_all":
        return documents
          .filter((d) => d.title.toLowerCase().includes(String(args.query).toLowerCase()))
          .map((d) => ({
            kind: "document",
            id: d.id,
            title: d.title,
            subKind: d.kind,
            snippet: `…\u0002${d.title}\u0003 scanned text…`,
          }));
      case "document_ocr_text":
        return "REPUBLIC OF NOWHERE · PASSPORT · No. X1234567";
      case "document_reveal": {
        const d = documents.find((x) => x.id === args.id);
        if (d) d.revealed = true;
        return null;
      }
      case "document_update": {
        const d = documents.find((x) => x.id === args.id);
        if (d) Object.assign(d, args.patch as Partial<DocumentItem>);
        return d;
      }
      case "documents_export_many":
        return { exported: (args.ids as string[]).length, skipped: [] };
      case "phone_upload_start":
        return {
          url: "http://192.168.178.24:52814/3f9c2a1b7e6d4c5a8b0e1f2a3b4c5d6e/",
          qrSvg:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 21 21"><rect width="21" height="21" fill="#fff"/><path d="M1 1h7v7H1zM13 1h7v7h-7zM1 13h7v7H1zM10 10h2v2h-2zM14 14h3v3h-3z" fill="#000"/></svg>',
          expiresAt: Date.now() + 600_000,
        };
      case "note_reveal": {
        const n = notes.find((x) => x.id === args.id);
        if (n) n.revealed = true;
        return null;
      }
      case "take_pending_imports":
        return [];
      case "document_preview_image":
        return fakeJpeg(Number(args.max));
      case "document_content":
        return new ArrayBuffer(0);
      default:
        return null;
    }
  }
}
