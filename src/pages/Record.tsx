import { useEffect, useState } from "react";
import { fetchRecord } from "@/utils/ddb";
import type { MetaItem } from "@/types/metadata";

function Section({label, children}:{label:string; children:React.ReactNode}) {
  return (
    <div style={{marginBottom:16}}>
      <div style={{fontWeight:600, marginBottom:6}}>{label}</div>
      <div style={{whiteSpace:"pre-wrap", maxHeight:420, overflow:"auto"}}>{children}</div>
    </div>
  );
}

export default function RecordPage() {
  const fileName = decodeURIComponent(location.pathname.replace(/^.*\/record\//, ""));
  const [item, setItem] = useState<MetaItem | null>(null);
  const [err, setErr]   = useState<string | null>(null);

  useEffect(() => {
    fetchRecord(fileName)
      .then((it) => it ? setItem(it as MetaItem) : setErr(`Record not found for ${fileName}`))
      .catch((e) => setErr(String(e)));
  }, [fileName]);

  if (err)     return <div style={{color:"#c00"}}>{err}</div>;
  if (!item)   return <div>Loading…</div>;

  const blocks: Array<{label:string; value:React.ReactNode}> = [];

  // 1) Key Phrases first (if present for this type)
  if (item.Type !== "tsv") {
    blocks.push({ label: "Key Phrases", value: item.KeyPhrases && item.KeyPhrases.length ? item.KeyPhrases : "No key phrases available" });
  }

  // 2) Content second
  blocks.push({ label: "Content", value: item.Content ?? "" });

  // 3) Remaining fields by type (most → least important)
  const pushNum = (v: any, label: string) => { if (v !== undefined && v !== null) blocks.push({ label, value: String(v) }); };

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