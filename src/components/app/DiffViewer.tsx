import { useMemo, useState } from "react";
import { ChevronDown, FilePlus2, FileCode2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Line {
  kind: "add" | "del" | "ctx" | "hunk";
  text: string;
  oldNo: number | null;
  newNo: number | null;
}
interface FileDiff {
  path: string;
  isNew: boolean;
  added: number;
  removed: number;
  lines: Line[];
}

export function parseUnifiedDiff(diff: string): FileDiff[] {
  const files: FileDiff[] = [];
  let cur: FileDiff | null = null;
  let oldNo = 0;
  let newNo = 0;
  const rows = diff.split("\n");
  for (let i = 0; i < rows.length; i++) {
    const l = rows[i]!;
    if (l.startsWith("Index: ") || l.startsWith("=====")) continue;
    if (l.startsWith("--- ")) {
      const next = rows[i + 1] ?? "";
      const path = next.startsWith("+++ ") ? next.slice(4).split("\t")[0]!.replace(/^b\//, "") : l.slice(4);
      cur = { path, isNew: l.includes("/dev/null"), added: 0, removed: 0, lines: [] };
      files.push(cur);
      i++;
      continue;
    }
    if (!cur) continue;
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(l);
    if (m) {
      oldNo = Number(m[1]);
      newNo = Number(m[2]);
      cur.lines.push({ kind: "hunk", text: l, oldNo: null, newNo: null });
    } else if (l.startsWith("+")) {
      cur.added++;
      cur.lines.push({ kind: "add", text: l.slice(1), oldNo: null, newNo: newNo++ });
    } else if (l.startsWith("-")) {
      cur.removed++;
      cur.lines.push({ kind: "del", text: l.slice(1), oldNo: oldNo++, newNo: null });
    } else if (l.startsWith(" ")) {
      cur.lines.push({ kind: "ctx", text: l.slice(1), oldNo: oldNo++, newNo: newNo++ });
    }
  }
  return files;
}

export function DiffViewer({ diff }: { diff: string }) {
  const { t } = useI18n();
  const files = useMemo(() => parseUnifiedDiff(diff), [diff]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const totalAdd = files.reduce((s, f) => s + f.added, 0);
  const totalDel = files.reduce((s, f) => s + f.removed, 0);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-medium">
          {files.length} {t.diff.files}
        </span>
        <span className="font-mono text-success" dir="ltr">+{totalAdd}</span>
        <span className="font-mono text-destructive" dir="ltr">−{totalDel}</span>
      </div>
      {files.map((f) => {
        const isOpen = open[f.path] ?? files.length <= 3;
        return (
          <div key={f.path} className="overflow-hidden rounded-lg border border-border">
            <button
              className="flex w-full items-center gap-2 bg-muted px-3 py-2 text-start"
              onClick={() => setOpen((o) => ({ ...o, [f.path]: !isOpen }))}
            >
              {f.isNew ? <FilePlus2 className="size-4 text-success" /> : <FileCode2 className="size-4 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate font-mono text-[13px]" dir="ltr">
                {f.path}
              </span>
              {f.isNew && <span className="rounded bg-success/15 px-1.5 text-xs text-success">{t.diff.newFile}</span>}
              <span className="font-mono text-xs text-success" dir="ltr">+{f.added}</span>
              <span className="font-mono text-xs text-destructive" dir="ltr">−{f.removed}</span>
              <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div className="overflow-x-auto bg-card" dir="ltr">
                <table className="w-full border-collapse font-mono text-[12.5px] leading-[1.55]">
                  <tbody>
                    {f.lines.map((l, i) => (
                      <tr
                        key={i}
                        className={cn(
                          l.kind === "add" && "bg-success/10",
                          l.kind === "del" && "bg-destructive/10",
                          l.kind === "hunk" && "bg-info/10 text-info",
                        )}
                      >
                        <td className="w-10 select-none px-2 text-right text-muted-foreground/70">{l.oldNo ?? ""}</td>
                        <td className="w-10 select-none px-2 text-right text-muted-foreground/70">{l.newNo ?? ""}</td>
                        <td className="w-4 select-none text-center">{l.kind === "add" ? "+" : l.kind === "del" ? "−" : ""}</td>
                        <td className="whitespace-pre pe-4">{l.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
