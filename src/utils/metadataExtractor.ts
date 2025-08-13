import * as XLSX from 'xlsx';

export const extractMetadata = async (file: File): Promise<Record<string, any>> => {
  const extension = (file.name.split('.').pop() || '').toLowerCase();
  const base: Record<string, any> = {
    originalName: file.name,
    extension,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    sizeMB: +(file.size / 1024 / 1024).toFixed(2),
    lastModified: new Date(file.lastModified).toISOString(),
  };

  const readTextSafe = async (): Promise<string | null> => {
    try {
      // Read at most ~5MB to avoid huge memory usage for very large files
      const text = await file.text();
      return text;
    } catch {
      return null;
    }
  };

  // Lightweight heuristics for common types
  if (extension === 'csv' || extension === 'tsv') {
    const text = await readTextSafe();
    if (!text) return { ...base, parser: 'none', note: 'Could not read file for header extraction' };

    const delimiter = extension === 'tsv' ? '\t' : ',';
    const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 6);
    const header = (lines[0] || '').split(delimiter).map(h => h.replace(/^\"|\"$/g, '').trim());

    return {
      ...base,
      parser: 'delimited',
      delimiter,
      columnCount: header.filter(Boolean).length,
      columns: header.slice(0, 20),
      sampleRowsAnalyzed: Math.max(0, lines.length - 1),
    };
  }

  if (extension === 'json') {
    const text = await readTextSafe();
    if (!text) return { ...base, parser: 'none', note: 'Could not read JSON content' };
    try {
      const json = JSON.parse(text);
      if (Array.isArray(json)) {
        const first = json[0];
        return {
          ...base,
          parser: 'json',
          isArray: true,
          recordCount: json.length,
          topLevelKeys: first && typeof first === 'object' ? Object.keys(first).slice(0, 50) : [],
        };
      }
      return {
        ...base,
        parser: 'json',
        isArray: false,
        topLevelKeys: typeof json === 'object' && json ? Object.keys(json).slice(0, 50) : [],
      };
    } catch (e: any) {
      return { ...base, parser: 'json', parseError: String(e?.message || e) };
    }
  }

  if (extension === 'txt') {
    const text = await readTextSafe();
    const lines = text ? text.split(/\r?\n/) : [];
    return {
      ...base,
      parser: 'text',
      approxLineCount: lines.length,
      preview: lines.slice(0, 3).join('\n'),
    };
  }

  // Excel spreadsheets
  if (extension === 'xlsx' || extension === 'xls') {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheetNames = workbook.SheetNames || [];
      const firstSheetName = sheetNames[0];
      const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : undefined;
      let header: string[] = [];
      let rowCount = 0;
      if (firstSheet) {
        const rows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1, blankrows: false });
        rowCount = Math.max(0, (rows?.length || 0) - 1);
        header = Array.isArray(rows?.[0]) ? rows[0].map((c) => String(c ?? '').trim()).filter(Boolean) : [];
      }
      return {
        ...base,
        parser: 'xlsx',
        sheetNames,
        firstSheetName,
        columnCount: header.length,
        columns: header.slice(0, 50),
        rowCount,
      };
    } catch (e) {
      return { ...base, parser: 'xlsx', parseError: String((e as any)?.message || e) };
    }
  }

  // Fallback for other formats
  return {
    ...base,
    parser: 'basic',
  };
};