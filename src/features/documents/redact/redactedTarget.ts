import type { DocumentItem } from "@/lib/ipc";
import { strings } from "@/lib/strings";

/** Suggested file name and extension for a redacted copy (PNG stays PNG, other images JPEG). */
export function redactedTarget(doc: Pick<DocumentItem, "filename" | "title" | "kind" | "mime">) {
  const stem = doc.filename.replace(/\.[^.]+$/, "") || doc.title;
  const ext = doc.kind === "pdf" ? "pdf" : doc.mime === "image/png" ? "png" : "jpg";
  return { name: `${stem} (${strings.redact.suffix}).${ext}`, ext };
}
