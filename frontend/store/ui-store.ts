import { create } from "zustand";

interface UIState {
  citationsPanelOpen: boolean;
  toggleCitationsPanel: () => void;
  activeCitations: Record<string, CitationData>;
  setActiveCitations: (citations: Record<string, CitationData>) => void;
}

export interface CitationData {
  document_id: string;
  page_number: number | null;
  section_heading: string | null;
  content_preview: string;
  confidence: number;
}

export const useUIStore = create<UIState>((set) => ({
  citationsPanelOpen: true,
  toggleCitationsPanel: () => set((s) => ({ citationsPanelOpen: !s.citationsPanelOpen })),
  activeCitations: {},
  setActiveCitations: (citations) => set({ activeCitations: citations }),
}));
