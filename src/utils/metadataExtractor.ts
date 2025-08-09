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

  // Fallback for other formats (e.g., xlsx)
  return {
    ...base,
    parser: 'basic',
  };
};
