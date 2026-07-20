"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Trash2, Upload, CheckCircle2, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useDocumentStore } from "@/store/document-store";
import { useChatStore } from "@/store/chat-store";
import { apiGet, apiDelete } from "@/lib/api";
import type { Document } from "@/store/document-store";

async function fetchDocuments(): Promise<Document[]> {
  return apiGet<Document[]>("/api/documents");
}

const statusIcon = {
  ready: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  embedding: <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />,
  chunking: <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />,
  pending: <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />,
  failed: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
};

export function DocumentSidebar() {
  const qc = useQueryClient();
  const { documents, setDocuments, removeDocument, toggleSelect, selectedIds } = useDocumentStore();
  const { setSelectedDocumentIds } = useChatStore();

  useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const docs = await fetchDocuments();
      setDocuments(docs);
      return docs;
    },
    refetchInterval: 5000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiDelete(`/api/documents/${id}`);
    },
    onSuccess: (_: void, id: string) => {
      removeDocument(id);
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const handleToggle = (id: string) => {
    toggleSelect(id);
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedDocumentIds([...next]);
  };

  return (
    <aside className="w-64 border-r flex flex-col bg-card">
      <div className="p-4 border-b flex items-center justify-between">
        <span className="font-semibold text-sm">Documents</span>
        <a href="/upload" className="text-primary hover:opacity-80">
          <Upload className="h-4 w-4" />
        </a>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {documents.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-8 px-4">
            Upload documents to start asking questions.
          </p>
        )}
        {documents.map((doc) => (
          <div
            key={doc.id}
            onClick={() => doc.status === "ready" && handleToggle(doc.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm group
              ${selectedIds.has(doc.id) ? "bg-primary/10 text-primary" : "hover:bg-muted"}
              ${doc.status !== "ready" ? "opacity-60 cursor-default" : ""}
            `}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{doc.original_name}</span>
            {doc.status === "ready" && (
              <Link
                href={`/documents/${doc.id}`}
                onClick={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
            {statusIcon[doc.status]}
            {doc.status === "ready" && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(doc.id); }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
