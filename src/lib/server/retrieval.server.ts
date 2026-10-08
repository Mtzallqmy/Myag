// Project search + grounded context retrieval (server-only).
import { keywords } from "@/lib/projects/keywords";

export interface SearchHit {
  kind: "file" | "text" | "symbol";
  path: string;
  line: number | null;
  symbol: string | null;
  preview: string;
}

function escapeLike(q: string) {
  return q.replace(/[\\%_]/g, (m) => `\\${m}`);
}

export async function searchProjectInternal(supabase: any, projectId: string, query: string, kinds: ("file" | "text" | "symbol")[], limit = 40): Promise<SearchHit[]> {
  const like = `%${escapeLike(query)}%`;
  const hits: SearchHit[] = [];
  if (kinds.includes("file")) {
    const { data } = await supabase.from("project_files").select("path").eq("project_id", projectId).ilike("path", like).limit(limit);
    for (const f of data ?? []) hits.push({ kind: "file", path: f.path, line: null, symbol: null, preview: f.path });
  }
  if (kinds.includes("symbol")) {
    const { data } = await supabase
      .from("project_symbols")
      .select("name, symbol_type, start_line, project_files(path)")
      .eq("project_id", projectId)
      .ilike("name", like)
      .limit(limit);
    for (const s of data ?? [])
      hits.push({ kind: "symbol", path: s.project_files?.path ?? "", line: s.start_line, symbol: s.name, preview: `${s.symbol_type} ${s.name}` });
  }
  if (kinds.includes("text")) {
    const { data } = await supabase
      .from("project_chunks")
      .select("content, start_line, project_files(path)")
      .eq("project_id", projectId)
      .ilike("content", like)
      .limit(limit);
    const ql = query.toLowerCase();
    for (const c of data ?? []) {
      const lines: string[] = c.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]!.toLowerCase().includes(ql)) {
          hits.push({ kind: "text", path: c.project_files?.path ?? "", line: c.start_line + i, symbol: null, preview: lines[i]!.trim().slice(0, 200) });
          if (hits.length > limit * 3) break;
        }
      }
    }
  }
  return hits;
}

/** Retrieves grounded context: symbol and text matches, ranked by keyword hits. */
export async function retrieveContext(supabase: any, projectId: string, question: string, maxChunks = 8) {
  const kws = keywords(question);
  const scored = new Map<string, { path: string; start: number; content: string; score: number }>();
  for (const kw of kws) {
    const { data } = await supabase
      .from("project_chunks")
      .select("id, content, start_line, project_files(path)")
      .eq("project_id", projectId)
      .ilike("content", `%${escapeLike(kw)}%`)
      .limit(15);
    for (const c of data ?? []) {
      const prev = scored.get(c.id);
      const pathBoost = (c.project_files?.path ?? "").toLowerCase().includes(kw.toLowerCase()) ? 2 : 0;
      scored.set(c.id, { path: c.project_files?.path ?? "", start: c.start_line, content: c.content, score: (prev?.score ?? 0) + 1 + pathBoost });
    }
    const { data: files } = await supabase.from("project_files").select("id, path").eq("project_id", projectId).ilike("path", `%${escapeLike(kw)}%`).limit(3);
    for (const f of files ?? []) {
      const { data: first } = await supabase.from("project_chunks").select("id, content, start_line").eq("file_id", f.id).order("chunk_index").limit(1);
      const c = first?.[0];
      if (c) scored.set(c.id, { path: f.path, start: c.start_line, content: c.content, score: (scored.get(c.id)?.score ?? 0) + 3 });
    }
  }
  return [...scored.values()].sort((a, b) => b.score - a.score).slice(0, maxChunks);
}

