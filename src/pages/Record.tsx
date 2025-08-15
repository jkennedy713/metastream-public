import { useEffect, useMemo, useRef, useState } from "react";
import { fetchRecord } from "@/utils/ddb";
import type { MetaItem } from "@/types/metadata";

const CHUNK = 40000;
const INITIAL = 20000;

function Section({label, children}:{label:string; children:React.ReactNode}) {
  return (
    <div style={{marginBottom:16}}>
      <div style={{fontWeight:600, marginBottom:6}}>{label}</div>
      <div style={{whiteSpace:"pre-wrap", maxHeight:420, overflow:"auto", lineHeight:1.4}}>{children}</div>
    </div>
  );
}

export default function RecordPage() {
  const fileName = decodeURIComponent(location.pathname.replace(/^.*\/record\//, ""));
  const [item, setItem] = useState<MetaItem | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [shown, setShown] = useState<number>(INITIAL);
  const acRef = useRef<AbortController | null>(null);

  useEffect(() => {
    acRef.current?.abort();
    const ac = new AbortController();
    acRef.current = ac;
    setErr(null); setItem(null); setShown(INITIAL);
    fetchRecord(fileName, undefined, ac.signal)
      .then((it) => it ? setItem(it as MetaItem) : setErr(`Record not found for ${fileName}`))
      .catch((e) => !ac.signal.aborted && setErr(String(e)));
    return () => ac.abort();
  }, [fileName]);

  if (err)   return <div style={{color:"#c00"}}>{err}</div>;
  if (!item) return <div>Loading…</div>;

  const blocks: Array<{label:string; value:React.ReactNode}> = [];

  // 1) Key Phrases first (TSV has none by spec)
  if (item.Type !== "tsv") {
    blocks.push({
      label: "Key Phrases",
      value: (item.KeyPhrases && item.KeyPhrases.length) ? item.KeyPhrases : "No key phrases available"
    });
  }

  // 2) Content second (chunked)
  const content = item.Content ?? "";
  const canMore = content.length > shown;
  const view = useMemo(() => content.slice(0, shown), [content, shown]);
  blocks.push({
    label: "Content",
    value: (
      <>
        {view}
        {canMore && (
          <div style={{marginTop:8}}>
            <button onClick={() => setShown((n) => Math.min(n + CHUNK, content.length))}>Show more</button>
            <span style={{marginLeft:8, opacity:0.7}}>
              Showing {Math.min(shown, content.length)} of {content.length} chars
              {item.ContentTruncated ? " (truncated in backend)" : ""}
            </span>
          </div>
        )}
      </>
    )
  });

  // 3) Remaining fields by type (most → least)
  const pushNum = (v: unknown, label: string) => { if (v !== undefined && v !== null) blocks.push({ label, value: String(v) }); };

  switch (item.Type) {
    case "csv":
    case "xlsx":
      pushNum(item.ColCount, "Column Count");
      pushNum(item.ContentLength, "Content Length");
      pushNum(item.RowCount, "Row Count");
      break;
    case "tsv":
      pushNum(item.ColCount, "Column Count");
      pushNum(item.ContentLength, "Content Length");
      pushNum(item.RowCount, "Row Count");
      break;
    case "txt":
    case "json":
      pushNum(item.ContentLength, "Content Length");
      break;
  }

  return (
    <div>
      <h2 style={{marginBottom:12}}>{fileName}</h2>
      {blocks.map((b, i) => <Section key={i} label={b.label}>{b.value}</Section>)}
    </div>
  );
}