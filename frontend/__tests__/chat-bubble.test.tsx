import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatBubble } from "@/components/chat/chat-bubble";
import type { Message } from "@/store/chat-store";

const userMsg: Message = { id: "1", role: "user", content: "Hello there" };
const assistantMsg: Message = { id: "2", role: "assistant", content: "Hi! How can I help?" };
const streamingMsg: Message = { id: "3", role: "assistant", content: "Typing...", isStreaming: true };

describe("ChatBubble", () => {
  it("renders user message aligned right", () => {
    const { container } = render(<ChatBubble message={userMsg} />);
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("justify-end");
  });

  it("renders assistant message aligned left", () => {
    const { container } = render(<ChatBubble message={assistantMsg} />);
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("justify-start");
    expect(screen.getByText("AI")).toBeInTheDocument();
  });

  it("shows streaming cursor when isStreaming=true", () => {
    const { container } = render(<ChatBubble message={streamingMsg} />);
    // streaming cursor is an inline span with animate-pulse
    const cursor = container.querySelector(".animate-pulse");
    expect(cursor).toBeInTheDocument();
  });

  it("copy button copies content to clipboard", async () => {
    const writeMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeMock } });

    render(<ChatBubble message={assistantMsg} />);
    // Copy button is hidden via opacity-0; trigger hover to reveal
    const bubble = screen.getByText("Hi! How can I help?").closest(".group");
    expect(bubble).toBeInTheDocument();

    const copyBtn = bubble!.querySelector("button");
    expect(copyBtn).toBeInTheDocument();
    fireEvent.click(copyBtn!);

    await waitFor(() => expect(writeMock).toHaveBeenCalledWith("Hi! How can I help?"));
  });

  it("does not show copy button for user messages", () => {
    const { container } = render(<ChatBubble message={userMsg} />);
    expect(container.querySelector("button")).toBeNull();
  });
});
