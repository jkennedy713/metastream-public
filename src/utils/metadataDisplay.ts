export const canonKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, '');

// Hidden metadata keys (canonicalized)
const HIDDEN_KEYS_CANON = new Set<string>([
  'id',
  'userid',
  's3key',
  'key',
  's3ley', // handle common typo
  'mimetype',
  'sizebytes',
  'lastmodified',
  'parser',
  'preview', // hide inline preview from metadata table
  'originalname', // remove originalName attribute from display
  'keyphrases', // hide keyPhrases from details table
]);

export const isHiddenMetaKey = (key: string): boolean => {
  const c = canonKey(key);
  return HIDDEN_KEYS_CANON.has(c);
};

export const filterMetadataForDisplay = (meta: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  Object.entries(meta || {}).forEach(([k, v]) => {
    if (!isHiddenMetaKey(k)) out[k] = v;
  });
  return out;
};
