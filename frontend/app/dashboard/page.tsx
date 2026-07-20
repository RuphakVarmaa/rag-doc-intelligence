"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { DocumentSidebar } from "@/components/documents/document-sidebar";
import { ChatPanel } from "@/components/chat/chat-panel";
import { CitationsPanel } from "@/components/citations/citations-panel";
import { useUIStore } from "@/store/ui-store";

export default function DashboardPage() {
  const { status } = useSession();
  const citationsPanelOpen = useUIStore((s) => s.citationsPanelOpen);

  if (status === "unauthenticated") redirect("/auth/signin");
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* Left: Document library */}
      <DocumentSidebar />

      {/* Center: Chat */}
      <main className="flex-1 flex flex-col min-w-0">
        <ChatPanel />
      </main>

      {/* Right: Citations (collapsible) */}
      {citationsPanelOpen && (
        <aside className="w-80 border-l flex flex-col">
          <CitationsPanel />
        </aside>
      )}
    </div>
  );
}
