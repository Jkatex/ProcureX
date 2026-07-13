export const documentsApi = {
  requestUpload: async (name: string) => ({ objectKey: `mock/${name}` }),
  contentUrl(documentId: string, download = false) {
    return `/api/documents/${documentId}/content${download ? '?download=true' : ''}`;
  }
};
