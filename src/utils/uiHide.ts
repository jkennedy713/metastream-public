const STORAGE_KEY = "metastream.hiddenKeys.v1";

type Key = { fileName: string; RecordID: string };

const k = (p: Key) => `${p.fileName}::${p.RecordID}`;

function load(): Set<string> {
  try { 
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]")); 
  }
  catch { 
    return new Set(); 
  }
}

function save(s: Set<string>) { 
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...s])); 
}

export function isHidden(p: Key) { 
  return load().has(k(p)); 
}

export function hideItem(p: Key) { 
  const s = load(); 
  s.add(k(p)); 
  save(s); 
}

export function unhideItem(p: Key) { 
  const s = load(); 
  s.delete(k(p)); 
  save(s); 
}

export function clearHidden() { 
  localStorage.removeItem(STORAGE_KEY); 
}

export function getHiddenKeys(): string[] { 
  return Array.from(load()); 
}