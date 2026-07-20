"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, ChevronDown, BookOpen } from "lucide-react";
import { useChatStore } from "@/store/chat-store";
import { useUIStore } from "@/store/ui-store";
import { apiFetch } from "@/lib/api";
import { ChatBubble } from "./chat-bubble";

const STARTERS = [
  "Summarise the key findings in these documents.",
  "What are the main risks identified?",
  "Compare the methodologies across documents.",
];

export function ChatPanel() {
  const [input, setInput] = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, isLoading, sessionId, selectedDocumentIds, pendingQuestion, addMessage, appendToken, finalizeMessage, setLoading, setSessionId, setPendingQuestion } = useChatStore();
  const { setActiveCitations, toggleCitationsPanel } = useUIStore();

  // Drain a question pre-filled from the PDF viewer
  useEffect(() => {
    if (pendingQuestion) {
      setInput(pendingQuestion);
      setPendingQuestion(null);
    }
  }, [pendingQuestion, setPendingQuestion]);

  useEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, atBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  };

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    setInput("");
    setLoading(true);

    const userMsgId = crypto.randomUUID();
    addMessage({ id: userMsgId, role: "user", content: text });

    const asstMsgId = crypto.randomUUID();
    addMessage({ id: asstMsgId, role: "assistant", content: "", isStreaming: true });

    try {
      const res = await apiFetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          message: text,
          document_ids: selectedDocumentIds,
        }),
      });

      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const event = JSON.parse(line.slice(6));
          if (event.type === "token") appendToken(asstMsgId, event.content);
          if (event.type === "citations") {
            finalizeMessage(asstMsgId, event.citations);
            setActiveCitations(event.citations);
          }
          if (event.type === "done" && event.session_id) setSessionId(event.session_id);
        }
      }
    } catch {
      finalizeMessage(asstMsgId, {});
    } finally {
      setLoading(false);
    }
  }, [isLoading, sessionId, selectedDocumentIds, addMessage, appendToken, finalizeMessage, setLoading, setSessionId, setActiveCitations]);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium">Chat</span>
        <button onClick={toggleCitationsPanel} className="text-muted-foreground hover:text-foreground transition-colors">
          <BookOpen className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p className="text-muted-foreground text-sm">Select documents from the sidebar, then ask a question.</p>
            <div className="flex flex-col gap-2 w-full max-w-sm">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => sendMessage(s)} className="text-sm text-left border rounded-lg px-4 py-2.5 hover:bg-muted transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg) => <ChatBubble key={msg.id} message={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Jump to bottom */}
      {!atBottom && (
        <button onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })} className="absolute bottom-20 right-6 bg-background border rounded-full p-2 shadow-md hover:bg-muted transition-colors">
          <ChevronDown className="h-4 w-4" />
        </button>
      )}

      {/* Input */}
      <div className="border-t p-4">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your documents…"
            disabled={isLoading}
            className="flex-1 border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          />
          <button type="submit" disabled={isLoading || !input.trim()} className="bg-primary text-primary-foreground px-3 py-2 rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
