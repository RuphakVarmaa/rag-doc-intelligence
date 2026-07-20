"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import type { Message } from "@/store/chat-store";

export function ChatBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
          AI
        </div>
      )}
      <div className={`relative group max-w-[80%] rounded-2xl px-4 py-3 text-sm
        ${isUser ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-muted rounded-tl-sm"}
      `}>
        {message.isStreaming ? (
          <span>
            {message.content}
            <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-current rounded-sm animate-pulse" />
          </span>
        ) : (
          message.content
        )}
        {!isUser && !message.isStreaming && (
          <button
            onClick={copy}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>
    </div>
  );
}
