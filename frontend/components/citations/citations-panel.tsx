"use client";

import { useUIStore } from "@/store/ui-store";
import { X } from "lucide-react";

function confidenceColor(score: number) {
  if (score >= 0.85) return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  if (score >= 0.65) return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
}

export function CitationsPanel() {
  const { activeCitations, toggleCitationsPanel } = useUIStore();
  const entries = Object.entries(activeCitations);

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium">Sources</span>
        <button onClick={toggleCitationsPanel} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {entries.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-8 px-4">
            Citations will appear here after each answer.
          </p>
        )}
        {entries.map(([chunkId, cite]) => (
          <div key={chunkId} className="border rounded-lg p-3 space-y-2 bg-card">
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {cite.section_heading && (
                  <span className="font-medium text-foreground block truncate">{cite.section_heading}</span>
                )}
                {cite.page_number && <span>Page {cite.page_number}</span>}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${confidenceColor(cite.confidence)}`}>
                {Math.round(cite.confidence * 100)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-3">{cite.content_preview}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
