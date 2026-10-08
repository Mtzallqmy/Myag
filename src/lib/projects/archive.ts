// Client/server-safe project ingestion helpers: safe archive listing + extraction,
// path sanitization, language/framework detection, symbol extraction and chunking.
import { unzipSync, strFromU8 } from "fflate";

export const LIMITS = {
  maxFiles: 5000,
  maxTotalBytes: 100 * 1024 * 1024, // extracted
  maxEntryBytes: 5 * 1024 * 1024,
  maxTextFileBytes: 512 * 1024, // indexed text per file
  maxCompressionRatio: 100,
  maxArchiveBytes: 50 * 1024 * 1024,
  chunkLines: 80,
};

export type ArchiveError =
  | "ARCHIVE_TOO_LARGE"
  | "ARCHIVE_INVALID"
  | "ARCHIVE_TOO_MANY_FILES"
  | "ARCHIVE_EXTRACTED_TOO_LARGE"
  | "ARCHIVE_BOMB"
  | "ARCHIVE_UNSAFE_PATH"
  | "ARCHIVE_SYMLINK";

export class ArchiveRejected extends Error {
  constructor(
    public code: ArchiveError,
    public detail?: string,
  ) {
    super(code);
  }
}

const IGNORED_DIRS = /(^|\/)(node_modules|\.git|\.svn|\.hg|dist|build|\.next|\.nuxt|\.turbo|\.cache|__pycache__|\.venv|venv|target|vendor|Pods|\.gradle|\.idea|\.vscode)(\/|$)/;

/** Returns a normalized safe relative path, or null if unsafe (Zip Slip, absolute, traversal). */
export function sanitizePath(raw: string): string | null {
  if (!raw || raw.length > 1024) return null;
  if (raw.includes("\0")) return null;
  const p = raw.replace(/\\/g, "/");
  if (p.startsWith("/") || /^[a-zA-Z]:/.test(p) || p.startsWith("//")) return null;
  const parts: string[] = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") return null;
    if (/[\u0000-\u001f]/.test(seg)) return null;
    parts.push(seg);
  }
  if (!parts.length) return null;
  return parts.join("/");
}

export const isIgnoredPath = (p: string) => IGNORED_DIRS.test(p);

export interface ZipEntryInfo {
  name: string;
  compressedSize: number;
  size: number;
  isDir: boolean;
  isSymlink: boolean;
}

/** Reads the ZIP central directory (no decompression) so limits can be enforced first. */
export function listZipEntries(buf: Uint8Array): ZipEntryInfo[] {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ArchiveRejected("ARCHIVE_INVALID");
  const total = view.getUint16(eocd + 10, true);
  const cdOffset = view.getUint32(eocd + 16, true);
  if (total === 0xffff || cdOffset === 0xffffffff) throw new ArchiveRejected("ARCHIVE_INVALID", "zip64");
  const out: ZipEntryInfo[] = [];
  let off = cdOffset;
  const dec = new TextDecoder();
  for (let i = 0; i < total; i++) {
    if (off + 46 > buf.length || view.getUint32(off, true) !== 0x02014b50) throw new ArchiveRejected("ARCHIVE_INVALID");
    const compressedSize = view.getUint32(off + 20, true);
    const size = view.getUint32(off + 24, true);
    const nameLen = view.getUint16(off + 28, true);
    const extraLen = view.getUint16(off + 30, true);
    const commentLen = view.getUint16(off + 32, true);
    const extAttr = view.getUint32(off + 38, true);
    const name = dec.decode(buf.subarray(off + 46, off + 46 + nameLen));
    const mode = extAttr >>> 16;
    out.push({
      name,
      compressedSize,
      size,
      isDir: name.endsWith("/"),
      isSymlink: (mode & 0o170000) === 0o120000,
    });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

export interface ExtractedFile {
  path: string;
  bytes: Uint8Array;
}

/** Safely extracts a ZIP: validates every entry before decompressing anything. */
export function safeExtractZip(buf: Uint8Array): { files: ExtractedFile[]; skipped: number } {
  if (buf.length > LIMITS.maxArchiveBytes) throw new ArchiveRejected("ARCHIVE_TOO_LARGE");
  const entries = listZipEntries(buf);
  const files = entries.filter((e) => !e.isDir);
  if (files.length > LIMITS.maxFiles) throw new ArchiveRejected("ARCHIVE_TOO_MANY_FILES");
  let total = 0;
  const allowed = new Map<string, string>();
  let skipped = 0;
  for (const e of files) {
    if (e.isSymlink) throw new ArchiveRejected("ARCHIVE_SYMLINK", e.name);
    const safe = sanitizePath(e.name);
    if (!safe) throw new ArchiveRejected("ARCHIVE_UNSAFE_PATH", e.name);
    if (e.size > LIMITS.maxEntryBytes || isIgnoredPath(safe) || /(^|\/)__MACOSX\//.test(safe)) {
      skipped++;
      continue;
    }
    if (e.compressedSize > 0 && e.size / e.compressedSize > LIMITS.maxCompressionRatio && e.size > 1024 * 1024) {
      throw new ArchiveRejected("ARCHIVE_BOMB", e.name);
    }
    total += e.size;
    if (total > LIMITS.maxTotalBytes) throw new ArchiveRejected("ARCHIVE_EXTRACTED_TOO_LARGE");
    allowed.set(e.name, safe);
  }
  let out: Record<string, Uint8Array>;
  try {
    out = unzipSync(buf, { filter: (f) => allowed.has(f.name) && f.originalSize <= LIMITS.maxEntryBytes });
  } catch {
    throw new ArchiveRejected("ARCHIVE_INVALID");
  }
  const result: ExtractedFile[] = [];
  for (const [name, bytes] of Object.entries(out)) {
    const path = allowed.get(name);
    if (!path || bytes.length > LIMITS.maxEntryBytes) continue; // declared size lied
    result.push({ path, bytes });
  }
  return { files: stripCommonRoot(result), skipped };
}

/** Removes a single shared top-level folder (e.g. "repo-main/"). */
export function stripCommonRoot<T extends { path: string }>(files: T[]): T[] {
  if (files.length < 2) return files;
  const first = files[0]!.path.split("/")[0];
  if (!first || !files.every((f) => f.path.startsWith(`${first}/`))) return files;
  return files.map((f) => ({ ...f, path: f.path.slice(first.length + 1) }));
}

// ---------- classification ----------

const LANG_BY_EXT: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript", js: "JavaScript", jsx: "JavaScript", mjs: "JavaScript", cjs: "JavaScript",
  py: "Python", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin", kts: "Kotlin", swift: "Swift", dart: "Dart",
  rb: "Ruby", php: "PHP", cs: "C#", cpp: "C++", cc: "C++", cxx: "C++", hpp: "C++", c: "C", h: "C",
  scala: "Scala", sql: "SQL", sh: "Shell", bash: "Shell", ps1: "PowerShell", lua: "Lua", r: "R",
  html: "HTML", css: "CSS", scss: "SCSS", sass: "SCSS", less: "Less", vue: "Vue", svelte: "Svelte",
  md: "Markdown", mdx: "Markdown", json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML", xml: "XML",
  txt: "Text", csv: "CSV", graphql: "GraphQL", proto: "Protobuf", dockerfile: "Dockerfile",
};

const NON_CODE = new Set(["Markdown", "JSON", "YAML", "TOML", "XML", "Text", "CSV"]);

export function extOf(path: string): string {
  const name = path.split("/").pop() ?? path;
  if (/^dockerfile$/i.test(name)) return "dockerfile";
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i + 1).toLowerCase() : "";
}

export const languageOf = (path: string): string | null => LANG_BY_EXT[extOf(path)] ?? null;

export function isProbablyBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 8000);
  let suspicious = 0;
  for (let i = 0; i < n; i++) {
    const b = bytes[i]!;
    if (b === 0) return true;
    if (b < 7 || (b > 14 && b < 32)) suspicious++;
  }
  return n > 0 && suspicious / n > 0.1;
}

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  json: "application/json",
  md: "text/markdown",
  csv: "text/csv",
};
export const mimeOf = (path: string) => MIME[extOf(path)] ?? (languageOf(path) ? "text/plain" : "application/octet-stream");

/** Extracts readable text from DOCX/XLSX (themselves ZIPs). PDF text is not extracted. */
export function officeText(path: string, bytes: Uint8Array): string | null {
  const ext = extOf(path);
  if (ext !== "docx" && ext !== "xlsx") return null;
  try {
    const want = ext === "docx" ? "word/document.xml" : "xl/sharedStrings.xml";
    const entries = listZipEntries(bytes);
    const target = entries.find((e) => e.name === want);
    if (!target || target.size > LIMITS.maxEntryBytes) return null;
    const out = unzipSync(bytes, { filter: (f) => f.name === want });
    const xml = strFromU8(out[want]!);
    return xml
      .replace(/<\/w:p>|<\/si>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return null;
  }
}

// ---------- symbols ----------

export interface SymbolInfo {
  symbol_type: string;
  name: string;
  start_line: number;
}

const SYMBOL_RULES: Record<string, { re: RegExp; type: string }[]> = {
  TypeScript: [
    { re: /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/, type: "function" },
    { re: /^\s*(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/, type: "class" },
    { re: /^\s*(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/, type: "interface" },
    { re: /^\s*(?:export\s+)?type\s+([A-Za-z_$][\w$]*)\s*[=<]/, type: "type" },
    { re: /^\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/, type: "function" },
    { re: /^\s*(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)/, type: "enum" },
  ],
  Python: [
    { re: /^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)/, type: "function" },
    { re: /^\s*class\s+([A-Za-z_]\w*)/, type: "class" },
  ],
  Go: [
    { re: /^func\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)/, type: "function" },
    { re: /^type\s+([A-Za-z_]\w*)\s+(?:struct|interface)/, type: "type" },
  ],
  Rust: [
    { re: /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)/, type: "function" },
    { re: /^\s*(?:pub\s+)?(?:struct|enum|trait)\s+([A-Za-z_]\w*)/, type: "type" },
  ],
  Java: [
    { re: /^\s*(?:public|private|protected)?\s*(?:static\s+)?(?:final\s+)?(?:abstract\s+)?(?:class|interface|enum|record)\s+([A-Za-z_]\w*)/, type: "class" },
  ],
  Ruby: [
    { re: /^\s*def\s+([A-Za-z_][\w?!.]*)/, type: "function" },
    { re: /^\s*(?:class|module)\s+([A-Z]\w*)/, type: "class" },
  ],
  PHP: [
    { re: /^\s*(?:public|private|protected|static|\s)*function\s+([A-Za-z_]\w*)/, type: "function" },
    { re: /^\s*(?:abstract\s+|final\s+)?class\s+([A-Za-z_]\w*)/, type: "class" },
  ],
};
SYMBOL_RULES["JavaScript"] = SYMBOL_RULES["TypeScript"]!;
SYMBOL_RULES["Kotlin"] = [
  { re: /^\s*(?:private\s+|public\s+|internal\s+)?(?:suspend\s+)?fun\s+([A-Za-z_]\w*)/, type: "function" },
  { re: /^\s*(?:data\s+|sealed\s+|abstract\s+|open\s+)?(?:class|interface|object)\s+([A-Za-z_]\w*)/, type: "class" },
];
SYMBOL_RULES["C#"] = SYMBOL_RULES["Java"]!;
SYMBOL_RULES["Dart"] = [{ re: /^\s*(?:abstract\s+)?class\s+([A-Za-z_]\w*)/, type: "class" }];

export function extractSymbols(language: string | null, text: string): SymbolInfo[] {
  const rules = language ? SYMBOL_RULES[language] : undefined;
  if (!rules) return [];
  const out: SymbolInfo[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length && out.length < 500; i++) {
    const line = lines[i]!;
    if (line.length > 400) continue;
    for (const r of rules) {
      const m = r.re.exec(line);
      if (m?.[1]) {
        out.push({ symbol_type: r.type, name: m[1], start_line: i + 1 });
        break;
      }
    }
  }
  return out;
}

export function chunkText(text: string, size = LIMITS.chunkLines): { index: number; startLine: number; content: string }[] {
  const lines = text.split("\n");
  const chunks = [];
  for (let i = 0, idx = 0; i < lines.length; i += size, idx++) {
    chunks.push({ index: idx, startLine: i + 1, content: lines.slice(i, i + size).join("\n") });
  }
  return chunks;
}

// ---------- scanner ----------

export interface ScanResult {
  languages: Record<string, number>; // language -> file count (code only)
  frameworks: string[];
  packageManagers: string[];
  buildSystems: string[];
  testFrameworks: string[];
  manifests: string[];
  entryPoints: string[];
}

const MANIFESTS = [
  "package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json", "bun.lockb", "bun.lock", "requirements.txt",
  "pyproject.toml", "Pipfile", "poetry.lock", "go.mod", "Cargo.toml", "pom.xml", "build.gradle", "build.gradle.kts",
  "settings.gradle", "pubspec.yaml", "composer.json", "Gemfile", "Dockerfile", "docker-compose.yml", "Makefile",
  "CMakeLists.txt", "tsconfig.json", "vite.config.ts", "next.config.js", "next.config.mjs", "angular.json",
];

export function scanProject(files: { path: string; text: string | null }[]): ScanResult {
  const r: ScanResult = { languages: {}, frameworks: [], packageManagers: [], buildSystems: [], testFrameworks: [], manifests: [], entryPoints: [] };
  const add = (arr: string[], v: string) => {
    if (!arr.includes(v)) arr.push(v);
  };
  const byName = new Map<string, string | null>();
  for (const f of files) {
    const lang = languageOf(f.path);
    if (lang && !NON_CODE.has(lang)) r.languages[lang] = (r.languages[lang] ?? 0) + 1;
    const base = f.path.split("/").pop()!;
    if (MANIFESTS.includes(base) && f.path.split("/").length <= 3) {
      add(r.manifests, f.path);
      if (!byName.has(base)) byName.set(base, f.text);
    }
    if (/^(src\/)?(main|index|app|server)\.(t|j)sx?$|^(app|main|manage)\.py$|^main\.go$|^src\/main\.rs$|^lib\/main\.dart$/.test(f.path)) {
      add(r.entryPoints, f.path);
    }
  }
  const pkg = byName.get("package.json");
  if (pkg) {
    try {
      const j = JSON.parse(pkg) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string>; main?: string };
      const deps = { ...j.dependencies, ...j.devDependencies };
      const fw: [string, string][] = [
        ["next", "Next.js"], ["react", "React"], ["vue", "Vue"], ["svelte", "Svelte"], ["@angular/core", "Angular"],
        ["express", "Express"], ["fastify", "Fastify"], ["@nestjs/core", "NestJS"], ["@tanstack/react-start", "TanStack Start"],
        ["react-native", "React Native"], ["expo", "Expo"], ["electron", "Electron"], ["tailwindcss", "Tailwind CSS"],
      ];
      for (const [d, n] of fw) if (deps[d]) add(r.frameworks, n);
      for (const [d, n] of [["vitest", "Vitest"], ["jest", "Jest"], ["mocha", "Mocha"], ["@playwright/test", "Playwright"], ["cypress", "Cypress"]] as const)
        if (deps[d]) add(r.testFrameworks, n);
      if (deps["vite"]) add(r.buildSystems, "Vite");
      if (deps["webpack"]) add(r.buildSystems, "Webpack");
      if (j.main) add(r.entryPoints, j.main);
    } catch {
      /* invalid package.json: no detection */
    }
  }
  const py = `${byName.get("requirements.txt") ?? ""}\n${byName.get("pyproject.toml") ?? ""}`.toLowerCase();
  for (const [d, n] of [["django", "Django"], ["flask", "Flask"], ["fastapi", "FastAPI"]] as const) if (py.includes(d)) add(r.frameworks, n);
  if (py.includes("pytest")) add(r.testFrameworks, "pytest");
  if ((byName.get("pom.xml") ?? "").includes("spring-boot")) add(r.frameworks, "Spring Boot");
  if ((byName.get("build.gradle") ?? byName.get("build.gradle.kts") ?? "")?.includes("com.android")) add(r.frameworks, "Android");
  if ((byName.get("pubspec.yaml") ?? "").includes("flutter")) add(r.frameworks, "Flutter");
  if ((byName.get("composer.json") ?? "").includes("laravel")) add(r.frameworks, "Laravel");
  if ((byName.get("Gemfile") ?? "").includes("rails")) add(r.frameworks, "Rails");

  const pm: [string, string][] = [
    ["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "Yarn"], ["package-lock.json", "npm"], ["bun.lockb", "Bun"], ["bun.lock", "Bun"],
    ["poetry.lock", "Poetry"], ["Pipfile", "Pipenv"], ["requirements.txt", "pip"], ["go.mod", "Go modules"], ["Cargo.toml", "Cargo"],
    ["composer.json", "Composer"], ["Gemfile", "Bundler"], ["pubspec.yaml", "pub"],
  ];
  for (const [f, n] of pm) if (byName.has(f)) add(r.packageManagers, n);
  const bs: [string, string][] = [
    ["pom.xml", "Maven"], ["build.gradle", "Gradle"], ["build.gradle.kts", "Gradle"], ["Makefile", "Make"],
    ["CMakeLists.txt", "CMake"], ["Dockerfile", "Docker"],
  ];
  for (const [f, n] of bs) if (byName.has(f)) add(r.buildSystems, n);
  return r;
}
