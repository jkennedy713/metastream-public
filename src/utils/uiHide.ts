const STORAGE_KEY = "metastream.hiddenKeys.v1";

type KeyParts = { fileName?: string; RecordID?: string };

const k = (p: KeyParts) => `${p.fileName ?? ""}::${p.RecordID ?? ""}`;

function load(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
  } catch {
    return new Set<string>();
  }
}

function save(s: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(s)));
}

export function isHidden(p: KeyParts): boolean {
  return load().has(k(p));
}

export function hideItem(p: KeyParts): void {
  const set = load(); 
  set.add(k(p)); 
  save(set);
}

export function unhideItem(p: KeyParts): void {
  const set = load(); 
  set.delete(k(p)); 
  save(set);
}

export function clearHidden(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function getHiddenKeys(): string[] {
  return Array.from(load());
}