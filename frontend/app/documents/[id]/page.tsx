"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, MessageSquarePlus, Loader2, AlertCircle, ArrowLeft } from "lucide-react";
import { useDocumentStore } from "@/store/document-store";
import { useChatStore } from "@/store/chat-store";
import { apiGet } from "@/lib/api";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface ContextMenu {
  x: number;
  y: number;
  selectedText: string;
}

interface DocMeta {
  id: string;
  original_name: string;
  file_url: string;
  page_count: number | null;
  status: string;
}

export default function DocumentViewerPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [meta, setMeta] = useState<DocMeta | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.2);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { documents, selectedIds, toggleSelect } = useDocumentStore();
  const { setSelectedDocumentIds, setPendingQuestion } = useChatStore((s) => ({
    setSelectedDocumentIds: s.setSelectedDocumentIds,
    setPendingQuestion: s.setPendingQuestion,
  }));

  useEffect(() => {
    if (!id) return;

    const local = documents.find((d) => d.id === id);
    if (local?.status !== "ready") {
      setFetchError("Document is not ready yet.");
      return;
    }

    apiGet<DocMeta>(`/api/documents/${id}`)
      .then((data) => {
        setMeta(data);
        if (data.file_url) setPdfUrl(data.file_url);
      })
      .catch(() => setFetchError("Failed to load document metadata."));
  }, [id, documents]);

  const onDocumentLoad = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, selectedText: text });
  }, []);

  const askAboutSelection = useCallback(() => {
    if (!contextMenu || !id) return;
    const question = `Regarding: "${contextMenu.selectedText.slice(0, 200)}"\n\nCan you explain this?`;

    // Ensure this document is selected for chat
    if (!selectedIds.has(id)) {
      toggleSelect(id);
      setSelectedDocumentIds([...selectedIds, id]);
    }

    setPendingQuestion(question);
    setContextMenu(null);
    router.push("/dashboard");
  }, [contextMenu, id, selectedIds, toggleSelect, setSelectedDocumentIds, setInput, router]);

  useEffect(() => {
    const dismiss = () => setContextMenu(null);
    document.addEventListener("click", dismiss);
    return () => document.removeEventListener("click", dismiss);
  }, []);

  if (fetchError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p>{fetchError}</p>
          <button onClick={() => router.back()} className="text-sm underline">Go back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="border-b px-4 py-3 flex items-center gap-4 shrink-0">
        <button onClick={() => router.push("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="font-medium text-sm truncate flex-1">
          {meta?.original_name ?? "Loading…"}
        </span>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setScale((s) => Math.max(0.6, s - 0.2))}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* Page navigation */}
        {numPages > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs tabular-nums">{currentPage} / {numPages}</span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
              disabled={currentPage === numPages}
              className="p-1.5 rounded hover:bg-muted transition-colors disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}

        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center gap-1.5 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Ask about this doc
        </button>
      </header>

      {/* PDF viewer */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center p-6 bg-muted/30"
        onContextMenu={handleContextMenu}
      >
        {!pdfUrl && !pdfError && !fetchError && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {pdfError && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm">{pdfError}</p>
          </div>
        )}

        {pdfUrl && (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoad}
            onLoadError={() => setPdfError("Failed to render PDF. The file may be corrupted.")}
            loading={
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderAnnotationLayer
              renderTextLayer
              className="shadow-lg"
            />
          </Document>
        )}
      </div>

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-popover border rounded-lg shadow-lg p-1"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={askAboutSelection}
            className="flex items-center gap-2 text-sm px-3 py-2 rounded hover:bg-muted transition-colors w-full text-left"
          >
            <MessageSquarePlus className="h-4 w-4 shrink-0" />
            Ask about selected text
          </button>
        </div>
      )}
    </div>
  );
}
