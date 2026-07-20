import uuid
import pytest
from app.services.citation import build_context_with_citations, extract_citations
from app.services.retriever import RetrievedChunk


def _make_chunk(
    chunk_id: str | None = None,
    content: str = "Sample chunk content.",
    similarity: float = 0.9,
    page: int = 1,
) -> RetrievedChunk:
    return RetrievedChunk(
        chunk_id=uuid.UUID(chunk_id) if chunk_id else uuid.uuid4(),
        document_id=uuid.uuid4(),
        content=content,
        similarity=similarity,
        page_number=page,
        section_heading="Introduction",
        token_count=None,
    )


def test_build_context_wraps_chunks():
    c1 = _make_chunk()
    c2 = _make_chunk()
    context, chunk_map = build_context_with_citations([c1, c2])
    cid1 = str(c1.chunk_id)
    cid2 = str(c2.chunk_id)
    assert f"[CITE:{cid1}]" in context
    assert f"[/CITE:{cid1}]" in context
    assert f"[CITE:{cid2}]" in context
    assert len(chunk_map) == 2


def test_build_context_empty():
    context, chunk_map = build_context_with_citations([])
    assert context == ""
    assert chunk_map == {}


def test_extract_citations_parses_markers():
    c1 = _make_chunk(content="The sky is blue.")
    c2 = _make_chunk(content="Water is wet.")
    _, chunk_map = build_context_with_citations([c1, c2])
    cid1 = str(c1.chunk_id)
    cid2 = str(c2.chunk_id)

    response = f"[CITE:{cid1}] the sky is blue [/CITE:{cid1}] and [CITE:{cid2}] water is wet [/CITE:{cid2}]."
    cleaned, citations = extract_citations(response, chunk_map)

    cited_ids = {c.chunk_id for c in citations}
    assert cid1 in cited_ids
    assert cid2 in cited_ids
    assert "[CITE:" not in cleaned


def test_extract_citations_unknown_id_skipped():
    chunk = _make_chunk()
    _, chunk_map = build_context_with_citations([chunk])
    unknown = str(uuid.uuid4())
    response = f"[CITE:{unknown}] some text [/CITE:{unknown}]"
    _, citations = extract_citations(response, chunk_map)
    assert not any(c.chunk_id == unknown for c in citations)


def test_confidence_tied_to_similarity():
    chunk = _make_chunk(similarity=0.92)
    _, chunk_map = build_context_with_citations([chunk])
    cid = str(chunk.chunk_id)
    response = f"[CITE:{cid}] text [/CITE:{cid}]"
    _, citations = extract_citations(response, chunk_map)
    assert citations[0].confidence == pytest.approx(0.92)
