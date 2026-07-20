import { create } from "zustand";
import type { CitationData } from "./ui-store";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Record<string, CitationData>;
  isStreaming?: boolean;
}

interface ChatState {
  sessionId: string | null;
  messages: Message[];
  isLoading: boolean;
  selectedDocumentIds: string[];
  pendingQuestion: string | null;
  setSessionId: (id: string) => void;
  addMessage: (msg: Message) => void;
  appendToken: (id: string, token: string) => void;
  finalizeMessage: (id: string, citations: Record<string, CitationData>) => void;
  setLoading: (v: boolean) => void;
  setSelectedDocumentIds: (ids: string[]) => void;
  clearMessages: () => void;
  setPendingQuestion: (q: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  sessionId: null,
  messages: [],
  isLoading: false,
  selectedDocumentIds: [],
  pendingQuestion: null,
  setSessionId: (id) => set({ sessionId: id }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  appendToken: (id, token) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + token } : m
      ),
    })),
  finalizeMessage: (id, citations) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: false, citations } : m
      ),
    })),
  setLoading: (v) => set({ isLoading: v }),
  setSelectedDocumentIds: (ids) => set({ selectedDocumentIds: ids }),
  clearMessages: () => set({ messages: [], sessionId: null }),
  setPendingQuestion: (q) => set({ pendingQuestion: q }),
}));
