// Server-side ingestion: re-validates paths, stores file metadata, chunks and symbols.
import { chunkText, extractSymbols, extOf, isIgnoredPath, languageOf, LIMITS, sanitizePath, scanProject } from "@/lib/projects/archive";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface IngestFile {
  path: string;
  text: string | null; // null for binary / non-indexed files
  size: number;
  mime: string;
  isBinary: boolean;
}

export async function ingestFiles(projectId: string, userId: string, files: IngestFile[]) {
  const db = await admin();
  let accepted = 0;
  let rejected = 0;
  for (const f of files) {
    const path = sanitizePath(f.path);
    if (!path || isIgnoredPath(path)) {
      rejected++;
      continue;
    }
    const text = f.text !== null && f.text.length <= LIMITS.maxTextFileBytes ? f.text : null;
    const language = languageOf(path);
    const lineCount = text ? text.split("\n").length : 0;
    const { data: row, error } = await db
      .from("project_files")
      .upsert(
        {
          project_id: projectId,
          user_id: userId,
          path,
          file_name: path.split("/").pop()!,
          extension: extOf(path) || null,
          mime_type: f.mime.slice(0, 120),
          size_bytes: Math.max(0, Math.round(f.size)),
          sha256: text ? await sha256Hex(text) : null,
          language,
          is_binary: f.isBinary || text === null,
          line_count: lineCount,
          metadata_json: text === null && !f.isBinary ? { indexed: false, reason: "TOO_LARGE_OR_UNSUPPORTED" } : {},
        },
        { onConflict: "project_id,path" },
      )
      .select("id")
      .single();
    if (error || !row) {
      rejected++;
      continue;
    }
    accepted++;
    await db.from("project_chunks").delete().eq("file_id", row.id);
    await db.from("project_symbols").delete().eq("file_id", row.id);
    if (text) {
      const chunks = chunkText(text).map((c) => ({
        project_id: projectId,
        file_id: row.id,
        user_id: userId,
        chunk_index: c.index,
        start_line: c.startLine,
        content: c.content,
      }));
      for (let i = 0; i < chunks.length; i += 200) await db.from("project_chunks").insert(chunks.slice(i, i + 200));
      const symbols = extractSymbols(language, text).map((s) => ({
        project_id: projectId,
        file_id: row.id,
        user_id: userId,
        symbol_type: s.symbol_type,
        name: s.name.slice(0, 200),
        qualified_name: `${path}#${s.name}`.slice(0, 600),
        start_line: s.start_line,
      }));
      if (symbols.length) await db.from("project_symbols").insert(symbols);
    }
  }
  return { accepted, rejected };
}

/** Recomputes project summaries from stored files (no fabricated detection). */
export async function finalizeProject(projectId: string, userId: string) {
  const db = await admin();
  const { data: files } = await db
    .from("project_files")
    .select("id, path, file_name, size_bytes")
    .eq("project_id", projectId)
    .limit(LIMITS.maxFiles);
  const list = files ?? [];
  const manifestNames = new Set(["package.json", "requirements.txt", "pyproject.toml", "pom.xml", "build.gradle", "build.gradle.kts", "pubspec.yaml", "composer.json", "Gemfile"]);
  const manifestFiles = list.filter((f) => manifestNames.has(f.file_name) && f.path.split("/").length <= 3);
  const texts = new Map<string, string>();
  for (const mf of manifestFiles.slice(0, 20)) {
    const { data: chunks } = await db.from("project_chunks").select("content").eq("file_id", mf.id).order("chunk_index");
    texts.set(mf.path, (chunks ?? []).map((c) => c.content).join("\n"));
  }
  const scan = scanProject(list.map((f) => ({ path: f.path, text: texts.get(f.path) ?? null })));
  const size = list.reduce((s, f) => s + Number(f.size_bytes ?? 0), 0);
  await db
    .from("projects")
    .update({
      status: list.length ? "READY" : "FAILED",
      error_code: list.length ? null : "NO_FILES",
      file_count: list.length,
      size_bytes: size,
      language_summary: scan.languages,
      framework_summary: {
        frameworks: scan.frameworks,
        packageManagers: scan.packageManagers,
        buildSystems: scan.buildSystems,
        testFrameworks: scan.testFrameworks,
        manifests: scan.manifests,
        entryPoints: scan.entryPoints,
      },
    })
    .eq("id", projectId)
    .eq("user_id", userId);
  await db.from("audit_logs").insert({ user_id: userId, action: "PROJECT_INDEXED", entity_type: "project", entity_id: projectId, metadata_json: { files: list.length } });
  return { fileCount: list.length, scan };
}

/** Reads a stored text file (reconstructed from chunks). */
export async function readProjectFile(projectId: string, userId: string, path: string) {
  const db = await admin();
  const { data: file } = await db
    .from("project_files")
    .select("id, path, language, is_binary, line_count, size_bytes")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .eq("path", path)
    .maybeSingle();
  if (!file) return null;
  const { data: chunks } = await db.from("project_chunks").select("content").eq("file_id", file.id).order("chunk_index");
  return { ...file, content: file.is_binary ? null : (chunks ?? []).map((c) => c.content).join("\n") };
}
