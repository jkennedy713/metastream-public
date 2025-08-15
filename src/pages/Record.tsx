import { useEffect, useMemo, useRef, useState } from "react";
import { fetchRecord } from "@/utils/ddb";

type AnyItem = Record<string, any>;
const INITIAL = 20000;   // show first 20k chars of large strings
const CHUNK   = 40000;   // "Show more" adds 40k

function pretty(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
}

export default function RecordPage() {
  const fileName = decodeURIComponent(location.pathname.replace(/^.*\/record\//, ""));
  const [item, setItem] = useState<AnyItem | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [shown, setShown] = useState<Record<string, number>>({});
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => {
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;
    setErr(null); setItem(null); setShown({});
    fetchRecord(fileName, undefined, ac.signal)
      .then((it) => it ? setItem(it as AnyItem) : setErr(`Record not found for ${fileName}`))
      .catch((e) => !ac.signal.aborted && setErr(String(e)));
    return () => ac.abort();
  }, [fileName]);

  const orderedKeys = useMemo(() => {
    if (!item) return [];
    const keys = Object.keys(item);
    // Preferential order (if present), then alphabetical
    const priority = ["KeyPhrases", "Content", "FileName", "RecordID", "Type", "ColCount", "RowCount", "ContentLength", "ContentTruncated"];
    const set = new Set(priority.filter((k) => keys.includes(k)));
    const rest = keys.filter((k) => !set.has(k)).sort((a, b) => a.localeCompare(b));
    return [...set, ...rest];
  }, [item]);

  if (err) return <div style={{ color: "#c00" }}>{err}</div>;
  if (!item) return <div>Loading…</div>;

  return (
    <div>
      <h2 style={{ marginBottom: 12 }}>{fileName}</h2>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, width: "20%" }}>Attribute</th>
            <th style={{ textAlign: "left", padding: 8 }}>Value</th>
          </tr>
        </thead>
        <tbody>
          {orderedKeys.map((k) => {
            const raw = item[k];
            const text = pretty(raw);
            const limit = shown[k] ?? INITIAL;
            const isLarge = typeof raw === "string" && raw.length > limit;
            const view = isLarge ? raw.slice(0, limit) : text;

            return (
              <tr key={k} style={{ verticalAlign: "top" }}>
                <td style={{ padding: 8, fontWeight: 600, whiteSpace: "nowrap" }}>{k}</td>
                <td style={{ padding: 8 }}>
                  <div style={{ whiteSpace: "pre-wrap", maxHeight: 420, overflow: "auto", lineHeight: 1.4 }}>
                    {view}
                  </div>
                  {isLarge && (
                    <div style={{ marginTop: 8 }}>
                      <button onClick={() => setShown((m) => ({ ...m, [k]: Math.min((m[k] ?? INITIAL) + CHUNK, raw.length) }))}>
                        Show more
                      </button>
                      <span style={{ marginLeft: 8, opacity: 0.7 }}>
                        Showing {Math.min(limit, raw.length)} of {raw.length} chars
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}