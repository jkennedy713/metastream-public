export type FileType = "txt" | "csv" | "tsv" | "xlsx" | "json";

export interface MetaItem {
  FileName: string;
  RecordID: string;
  Type: FileType;
  Content?: string;
  ContentLength?: number;
  ContentTruncated?: boolean;
  KeyPhrases?: string; // comma-separated
  ColCount?: number;
  RowCount?: number;
}