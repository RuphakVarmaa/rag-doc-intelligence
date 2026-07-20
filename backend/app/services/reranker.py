from sentence_transformers import CrossEncoder
from app.services.retriever import RetrievedChunk
from app.config import get_settings
import structlog

log = structlog.get_logger()
settings = get_settings()

_cross_encoder: CrossEncoder | None = None


def get_cross_encoder() -> CrossEncoder:
    global _cross_encoder
    if _cross_encoder is None:
        _cross_encoder = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2")
    return _cross_encoder


def rerank(query: str, chunks: list[RetrievedChunk]) -> list[RetrievedChunk]:
    if not chunks:
        return []

    model = get_cross_encoder()
    pairs = [(query, c.content) for c in chunks]
    scores = model.predict(pairs)

    scored = sorted(zip(chunks, scores), key=lambda x: x[1], reverse=True)
    top_k = settings.rerank_top_k
    reranked = [chunk for chunk, _ in scored[:top_k]]
    log.debug("reranked_chunks", total=len(chunks), returned=len(reranked))
    return reranked
