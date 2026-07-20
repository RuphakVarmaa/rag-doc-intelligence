import re
import uuid
from dataclasses import dataclass
from app.services.retriever import RetrievedChunk


@dataclass
class Citation:
    chunk_id: str
    document_id: str
    page_number: int | None
    section_heading: str | None
    content_preview: str
    confidence: float


def build_context_with_citations(chunks: list[RetrievedChunk]) -> tuple[str, dict[str, RetrievedChunk]]:
    sorted_chunks = sorted(chunks, key=lambda c: (str(c.document_id), c.page_number or 0))
    chunk_map: dict[str, RetrievedChunk] = {}
    context_parts = []

    for chunk in sorted_chunks:
        cid = str(chunk.chunk_id)
        chunk_map[cid] = chunk
        heading = f"[{chunk.section_heading}] " if chunk.section_heading else ""
        page = f"(p.{chunk.page_number}) " if chunk.page_number else ""
        context_parts.append(f"[CITE:{cid}]\n{heading}{page}{chunk.content}\n[/CITE:{cid}]")

    return "\n\n".join(context_parts), chunk_map


def extract_citations(response_text: str, chunk_map: dict[str, RetrievedChunk]) -> tuple[str, list[Citation]]:
    pattern = r"\[CITE:([a-f0-9\-]+)\]"
    cited_ids = list(dict.fromkeys(re.findall(pattern, response_text)))

    citations = []
    for cid in cited_ids:
        if cid in chunk_map:
            chunk = chunk_map[cid]
            citations.append(
                Citation(
                    chunk_id=cid,
                    document_id=str(chunk.document_id),
                    page_number=chunk.page_number,
                    section_heading=chunk.section_heading,
                    content_preview=chunk.content[:200],
                    confidence=chunk.similarity,
                )
            )

    clean_response = re.sub(r"\[/?CITE:[a-f0-9\-]+\]", "", response_text).strip()
    return clean_response, citations
