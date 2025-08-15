import { useEffect, useState } from "react";
import { listItems } from "@/utils/ddb";

type Row = { FileName: string; RecordID?: string } & Record<string, any>;

export default function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    listItems(200).then((r) => setRows(r as Row[])).catch((e) => setErr(String(e))).finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading…</div>;
  if (err) return <div style={{ color: "#c00" }}>{err}</div>;

  return (
    <div>
      <h2>Metadata Dashboard</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8 }}>File Name</th>
            <th style={{ textAlign: "left", padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.FileName}|${r.RecordID || ""}`}>
              <td style={{ padding: 8 }}>{r.FileName}</td>
              <td style={{ padding: 8 }}>
                <a href={`/record/${encodeURIComponent(r.FileName)}`}>View</a>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={2} style={{ padding: 8 }}>No records yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}