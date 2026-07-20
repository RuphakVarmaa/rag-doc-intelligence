import { create } from "zustand";

export interface Document {
  id: string;
  original_name: string;
  status: "pending" | "chunking" | "embedding" | "ready" | "failed";
  page_count: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

interface DocumentState {
  documents: Document[];
  selectedIds: Set<string>;
  setDocuments: (docs: Document[]) => void;
  updateDocument: (id: string, patch: Partial<Document>) => void;
  addDocument: (doc: Document) => void;
  removeDocument: (id: string) => void;
  toggleSelect: (id: string) => void;
  clearSelection: () => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  documents: [],
  selectedIds: new Set(),
  setDocuments: (docs) => set({ documents: docs }),
  updateDocument: (id, patch) =>
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })),
  addDocument: (doc) => set((s) => ({ documents: [doc, ...s.documents] })),
  removeDocument: (id) =>
    set((s) => ({
      documents: s.documents.filter((d) => d.id !== id),
      selectedIds: new Set([...s.selectedIds].filter((sid) => sid !== id)),
    })),
  toggleSelect: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      next.has(id) ? next.delete(id) : next.add(id);
      return { selectedIds: next };
    }),
  clearSelection: () => set({ selectedIds: new Set() }),
}));
