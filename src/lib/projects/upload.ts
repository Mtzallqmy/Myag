// Browser-side upload pipeline: safe extraction (validated again on the server),
// archive stored in the private bucket, files sent to the server in bounded batches.
import { supabase } from "@/integrations/supabase/client";
import { ArchiveRejected, extOf, isIgnoredPath, isProbablyBinary, LIMITS, mimeOf, officeText, safeExtractZip, sanitizePath } from "./archive";

export interface PreparedFile {
  path: string;
  text: string | null;
  size: number;
  mime: string;
  isBinary: boolean;
}

export type Progress = { phase: "UPLOADING" | "EXTRACTING" | "INDEXING" | "DONE"; done: number; total: number };

function toPrepared(path: string, bytes: Uint8Array): PreparedFile {
  const office = officeText(path, bytes);
  if (office !== null) return { path, text: office.slice(0, LIMITS.maxTextFileBytes), size: bytes.length, mime: mimeOf(path), isBinary: false };
  const binary = extOf(path) === "pdf" || isProbablyBinary(bytes);
  const text = !binary && bytes.length <= LIMITS.maxTextFileBytes ? new TextDecoder("utf-8", { fatal: false }).decode(bytes) : null;
  return { path, text, size: bytes.length, mime: mimeOf(path), isBinary: binary };
}

export async function prepareFiles(
  files: File[],
  userId: string,
  projectId: string,
  onProgress: (p: Progress) => void,
): Promise<PreparedFile[]> {
  const out: PreparedFile[] = [];
  const zips = files.filter((f) => extOf(f.name) === "zip");
  const others = files.filter((f) => extOf(f.name) !== "zip");
  if (files.length > LIMITS.maxFiles) throw new ArchiveRejected("ARCHIVE_TOO_MANY_FILES");

  for (const z of zips) {
    if (z.size > LIMITS.maxArchiveBytes) throw new ArchiveRejected("ARCHIVE_TOO_LARGE");
    onProgress({ phase: "UPLOADING", done: 0, total: 1 });
    await supabase.storage.from("project-archives").upload(`${userId}/${projectId}/${Date.now()}-${z.name.replace(/[^\w.-]/g, "_")}`, z, {
      contentType: "application/zip",
      upsert: false,
    });
    onProgress({ phase: "EXTRACTING", done: 0, total: 1 });
    const { files: extracted } = safeExtractZip(new Uint8Array(await z.arrayBuffer()));
    for (const f of extracted) out.push(toPrepared(f.path, f.bytes));
  }

  let total = 0;
  for (const [i, f] of others.entries()) {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
    const path = sanitizePath(rel);
    if (!path || isIgnoredPath(path) || f.size > LIMITS.maxEntryBytes) continue;
    total += f.size;
    if (total > LIMITS.maxTotalBytes) throw new ArchiveRejected("ARCHIVE_EXTRACTED_TOO_LARGE");
    out.push(toPrepared(path, new Uint8Array(await f.arrayBuffer())));
    if (i % 50 === 0) onProgress({ phase: "EXTRACTING", done: i, total: others.length });
  }
  // strip shared root folder from directory uploads
  if (others.length > 1 && !zips.length) {
    const first = out[0]?.path.split("/")[0];
    if (first && out.every((f) => f.path.startsWith(`${first}/`))) for (const f of out) f.path = f.path.slice(first.length + 1);
  }
  return out;
}

/** Splits prepared files into server batches (≤150 files, ≤1.5MB text). */
export function batchFiles(files: PreparedFile[]): PreparedFile[][] {
  const batches: PreparedFile[][] = [];
  let cur: PreparedFile[] = [];
  let size = 0;
  for (const f of files) {
    const s = f.text?.length ?? 0;
    if (cur.length && (cur.length >= 150 || size + s > 1_500_000)) {
      batches.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(f);
    size += s;
  }
  if (cur.length) batches.push(cur);
  return batches;
}
