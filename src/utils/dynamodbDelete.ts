// Delete functionality has been removed per architectural requirements
// Client should not perform delete operations
export const deleteMetadataCompat = async (params: { id: string; filename?: string }) => {
  throw new Error('Delete functionality is disabled - not supported in current architecture');
};
