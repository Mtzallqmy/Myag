// Keyword extraction for grounded retrieval (Arabic + English).
const STOP = new Set(["the", "and", "for", "with", "what", "how", "does", "this", "that", "where", "which", "file", "code", "من", "في", "على", "ما", "هل", "كيف", "أين", "هذا", "التي", "الذي", "عن"]);

export function keywords(q: string): string[] {
  const words = q.match(/[\p{L}\p{N}_$.-]{3,}/gu) ?? [];
  return [...new Set(words.map((w) => w.replace(/[.-]+$/, "")).filter((w) => !STOP.has(w.toLowerCase())))].slice(0, 6);
}

