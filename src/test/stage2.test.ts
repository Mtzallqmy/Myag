import { describe, expect, it } from "vitest";
import { zipSync, strToU8 } from "fflate";
import { ArchiveRejected, extractSymbols, safeExtractZip, sanitizePath, scanProject, chunkText } from "@/lib/projects/archive";
import { findSecrets, redactSecrets, redactValue } from "@/lib/security/redact";
import { agentBranchName, approvalExecutable, checkTool, classifyMcpTool, defaultToolState, isProtectedBranch } from "@/lib/agent/policy";
import { parseUnifiedDiff } from "@/components/app/DiffViewer";
import { keywords } from "@/lib/projects/keywords";
import { prePushCheck } from "@/lib/server/github.server";
import { validateOutboundUrl } from "@/lib/ai/url-guard";

const rejects = (buf: Uint8Array, code: string) => {
  try {
    safeExtractZip(buf);
  } catch (e) {
    expect(e).toBeInstanceOf(ArchiveRejected);
    expect((e as ArchiveRejected).code).toBe(code);
    return;
  }
  throw new Error("expected rejection");
};

describe("safe archives", () => {
  it("extracts a normal zip and strips common root", () => {
    const zip = zipSync({ "repo-main/src/a.ts": strToU8("export const a = 1"), "repo-main/README.md": strToU8("# hi") });
    const { files } = safeExtractZip(zip);
    expect(files.map((f) => f.path).sort()).toEqual(["README.md", "src/a.ts"]);
  });
  it("rejects Zip Slip traversal", () => rejects(zipSync({ "../evil.sh": strToU8("x") }), "ARCHIVE_UNSAFE_PATH"));
  it("rejects absolute paths", () => rejects(zipSync({ "/etc/passwd": strToU8("x") }), "ARCHIVE_UNSAFE_PATH"));
  it("rejects symlinks", () => rejects(zipSync({ link: [strToU8("/etc/passwd"), { os: 3, attrs: (0o120777 << 16) >>> 0 }] }), "ARCHIVE_SYMLINK"));
  it("rejects decompression bombs", () => rejects(zipSync({ "big.txt": [new Uint8Array(4 * 1024 * 1024), { level: 9 }] }), "ARCHIVE_BOMB"));
  it("rejects garbage", () => rejects(new Uint8Array([1, 2, 3, 4]), "ARCHIVE_INVALID"));
  it("skips node_modules", () => {
    const { files } = safeExtractZip(zipSync({ "node_modules/x/index.js": strToU8("x"), "src/i.js": strToU8("y") }));
    expect(files.map((f) => f.path)).toEqual(["src/i.js"]);
  });
  it("sanitizes paths", () => {
    expect(sanitizePath("a/./b//c.ts")).toBe("a/b/c.ts");
    expect(sanitizePath("a\\..\\b")).toBeNull();
    expect(sanitizePath("C:/win")).toBeNull();
  });
});

describe("scanner + symbols", () => {
  it("detects frameworks only from real manifests", () => {
    const r = scanProject([
      { path: "package.json", text: JSON.stringify({ dependencies: { react: "19" }, devDependencies: { vitest: "1", vite: "5" } }) },
      { path: "pnpm-lock.yaml", text: "" },
      { path: "src/main.tsx", text: null },
    ]);
    expect(r.frameworks).toEqual(["React"]);
    expect(r.testFrameworks).toEqual(["Vitest"]);
    expect(r.packageManagers).toContain("pnpm");
    expect(r.entryPoints).toContain("src/main.tsx");
    expect(scanProject([{ path: "notes.txt", text: "react django" }]).frameworks).toEqual([]);
  });
  it("extracts symbols with lines", () => {
    const s = extractSymbols("TypeScript", "import x\nexport function login() {}\nclass Auth {}\nexport const go = async () => 1");
    expect(s.map((x) => [x.name, x.start_line])).toEqual([["login", 2], ["Auth", 3], ["go", 4]]);
    expect(extractSymbols("Python", "def a():\n  pass\nclass B:")[1]?.name).toBe("B");
  });
  it("chunks preserve start lines", () => {
    const text = Array.from({ length: 170 }, (_, i) => `l${i + 1}`).join("\n");
    expect(chunkText(text).map((c) => c.startLine)).toEqual([1, 81, 161]);
  });
  it("extracts keywords in Arabic and English", () => {
    expect(keywords("أين يتم التحقق من login في auth.ts؟")).toEqual(expect.arrayContaining(["login", "auth.ts", "التحقق"]));
  });
});

describe("output sanitizer", () => {
  it("redacts common secrets", () => {
    const s = redactSecrets("Authorization: Bearer abcdefghijklmnop\nkey sk-proj-abcdefghijklmnopqrstuv ghp_abcdefghijklmnopqrstuvwxyz1234 password=hunter2");
    expect(s).not.toMatch(/abcdefghijklmnop|hunter2|ghp_abc/);
  });
  it("deep-redacts sensitive keys", () => {
    expect(redactValue({ access_token: "x", nested: { refresh_token: "y", ok: "fine" } })).toEqual({ access_token: "[REDACTED]", nested: { refresh_token: "[REDACTED]", ok: "fine" } });
  });
  it("finds secrets before push", () => {
    expect(findSecrets("const k = 'AKIAABCDEFGHIJKLMNOP'").length).toBeGreaterThan(0);
    expect(findSecrets("const x = 1").length).toBe(0);
  });
});

describe("tool policy + approvals", () => {
  it("enforces modes", () => {
    expect(checkTool("project.apply_patch", "SUGGEST", { changeSetId: crypto.randomUUID() })).toEqual({ allowed: false, reason: "MODE_FORBIDS_TOOL" });
    expect(checkTool("project.read_file", "READ_ONLY", { path: "a.ts" })).toMatchObject({ allowed: true, approval: false });
    expect(checkTool("github.push", "WORKSPACE", { changeSetId: crypto.randomUUID() })).toMatchObject({ allowed: true, approval: true });
    expect(checkTool("shell.exec", "WORKSPACE", {})).toEqual({ allowed: false, reason: "UNKNOWN_TOOL" });
    expect(checkTool("project.read_file", "READ_ONLY", { path: "" })).toEqual({ allowed: false, reason: "INVALID_TOOL_INPUT" });
  });
  it("expired approvals cannot execute", () => {
    const now = new Date();
    const past = new Date(now.getTime() - 60 * 60_000).toISOString();
    expect(approvalExecutable({ status: "APPROVED", expires_at: past, decided_at: now.toISOString(), executed_at: null }, now)).toBe(false);
    const future = new Date(now.getTime() + 60_000).toISOString();
    expect(approvalExecutable({ status: "APPROVED", expires_at: future, decided_at: now.toISOString(), executed_at: null }, now)).toBe(true);
    expect(approvalExecutable({ status: "PENDING", expires_at: future, decided_at: null, executed_at: null }, now)).toBe(false);
    expect(approvalExecutable({ status: "APPROVED", expires_at: future, decided_at: now.toISOString(), executed_at: now.toISOString() }, now)).toBe(false);
  });
  it("protects default branches", () => {
    expect(isProtectedBranch("main", "main")).toBe(true);
    expect(isProtectedBranch("develop", "trunk")).toBe(true);
    expect(isProtectedBranch("feature/x", "main")).toBe(true);
    const b = agentBranchName("Fix Login Bug!", "abcdef1234");
    expect(b).toBe("agent/fix-login-bug-abcdef12");
    expect(isProtectedBranch(b, "main")).toBe(false);
    expect(prePushCheck("main", "main", [])).toBe("PROTECTED_BRANCH");
    expect(prePushCheck(b, "main", [{ path: "a", content: "ghp_abcdefghijklmnopqrstuvwxyz123456" }])).toBe("SECRET_DETECTED");
    expect(prePushCheck(b, "main", [{ path: "a", content: "ok" }])).toBeNull();
  });
});

describe("MCP risk + URL security", () => {
  it("classifies tools and never auto-enables dangerous ones", () => {
    expect(classifyMcpTool("list_files")).toBe("LOW");
    expect(classifyMcpTool("send_email")).toBe("HIGH");
    expect(classifyMcpTool("run_shell_command")).toBe("CRITICAL");
    expect(classifyMcpTool("get_secret")).toBe("CRITICAL");
    expect(classifyMcpTool("frobnicate")).toBe("HIGH");
    expect(defaultToolState("CRITICAL")).toEqual({ enabled: false, approval_required: true });
    expect(defaultToolState("HIGH").enabled).toBe(false);
  });
  it("blocks internal MCP URLs", () => {
    for (const u of ["http://mcp.example.com", "https://127.0.0.1/mcp", "https://169.254.169.254", "https://mcp.internal/x"]) expect(validateOutboundUrl(u).ok).toBe(false);
  });
});

describe("diff parsing", () => {
  it("counts additions and removals with line numbers", () => {
    const diff = "--- a/x.ts\n+++ b/x.ts\n@@ -1,2 +1,2 @@\n a\n-b\n+c\n";
    const [f] = parseUnifiedDiff(diff);
    expect(f).toMatchObject({ path: "x.ts", added: 1, removed: 1 });
    expect(f!.lines.find((l) => l.kind === "add")?.newNo).toBe(2);
  });
});
