// Server-side delete is disabled per architectural requirements
export async function deleteMetadataCompat(): Promise<void> {
  throw new Error("Server-side delete is disabled.");
}

export async function deleteMetadataByKeys(): Promise<void> {
  throw new Error("Server-side delete is disabled.");
}

export async function deleteMetadataFromRow(): Promise<void> {
  throw new Error("Server-side delete is disabled.");
}
