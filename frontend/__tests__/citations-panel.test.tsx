import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CitationsPanel } from "@/components/citations/citations-panel";

// Mock the ui store
vi.mock("@/store/ui-store", () => ({
  useUIStore: vi.fn(),
}));

import { useUIStore } from "@/store/ui-store";

const mockToggle = vi.fn();

const emptyCitations = {};
const filledCitations = {
  chunk1: {
    document_id: "doc-1",
    page_number: 3,
    section_heading: "Methodology",
    content_preview: "The study used a double-blind protocol.",
    confidence: 0.91,
  },
  chunk2: {
    document_id: "doc-1",
    page_number: 7,
    section_heading: null,
    content_preview: "Results showed a 42% improvement.",
    confidence: 0.62,
  },
};

describe("CitationsPanel", () => {
  it("shows empty state when no citations", () => {
    (useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCitations: emptyCitations,
      toggleCitationsPanel: mockToggle,
    });
    render(<CitationsPanel />);
    expect(screen.getByText(/citations will appear/i)).toBeInTheDocument();
  });

  it("renders citation cards", () => {
    (useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCitations: filledCitations,
      toggleCitationsPanel: mockToggle,
    });
    render(<CitationsPanel />);
    expect(screen.getByText("Methodology")).toBeInTheDocument();
    expect(screen.getByText(/double-blind protocol/)).toBeInTheDocument();
    expect(screen.getByText("Page 3")).toBeInTheDocument();
  });

  it("shows green badge for high confidence", () => {
    (useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCitations: filledCitations,
      toggleCitationsPanel: mockToggle,
    });
    const { container } = render(<CitationsPanel />);
    const badges = container.querySelectorAll("[class*='bg-green']");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("shows red badge for low confidence", () => {
    (useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCitations: filledCitations,
      toggleCitationsPanel: mockToggle,
    });
    const { container } = render(<CitationsPanel />);
    const badges = container.querySelectorAll("[class*='bg-red']");
    expect(badges.length).toBeGreaterThan(0);
  });

  it("calls toggleCitationsPanel on close click", () => {
    (useUIStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      activeCitations: emptyCitations,
      toggleCitationsPanel: mockToggle,
    });
    render(<CitationsPanel />);
    const closeBtn = screen.getByRole("button");
    fireEvent.click(closeBtn);
    expect(mockToggle).toHaveBeenCalledOnce();
  });
});
