from __future__ import annotations
"""
CueBI — Embedder
Converts text chunks into vectors using OpenAI text-embedding-3-small
and stores them in Qdrant.

Key design decisions:
- Batch size of 100: balances throughput vs rate limits
- text-embedding-3-small: 1536 dims, $0.02/1M tokens ≈ ₹0 at our scale
- Qdrant collection per connection_id: clean isolation, easy delete
- Upsert (not insert): safe to re-run schema sync without duplicates
"""

import os
import uuid
import asyncio
from openai import AsyncOpenAI
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance, VectorParams, PointStruct, Filter, FieldCondition, MatchValue
)

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMS  = 1536
QDRANT_COLLECTION = "cuebi_schema"
BATCH_SIZE = 100


def get_qdrant_client() -> QdrantClient:
    return QdrantClient(
        url=os.getenv("QDRANT_URL", "http://localhost:6333"),
        api_key=os.getenv("QDRANT_API_KEY") or None,
    )


def get_openai_client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


# ── Qdrant collection setup ───────────────────────────────────

def ensure_collection(client: QdrantClient) -> None:
    """Creates the Qdrant collection if it doesn't exist."""
    existing = [c.name for c in client.get_collections().collections]
    if QDRANT_COLLECTION not in existing:
        client.create_collection(
            collection_name=QDRANT_COLLECTION,
            vectors_config=VectorParams(size=EMBEDDING_DIMS, distance=Distance.COSINE),
        )


# ── Core embedding function ───────────────────────────────────

async def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Embeds a list of texts using OpenAI text-embedding-3-small.
    Batches requests to avoid rate limits.

    Returns:
        List of embedding vectors (one per input text).
    """
    client = get_openai_client()
    all_vectors = []

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        response = await client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=batch,
        )
        vectors = [item.embedding for item in response.data]
        all_vectors.extend(vectors)

        # Small delay between batches to stay under rate limits
        if i + BATCH_SIZE < len(texts):
            await asyncio.sleep(0.1)

    return all_vectors


async def embed_single(text: str) -> list[float]:
    """Embeds a single text (used for query-time embedding)."""
    vectors = await embed_texts([text])
    return vectors[0]


# ── Store chunks in Qdrant ────────────────────────────────────

async def store_chunks(connection_id: str, chunks: list[dict]) -> list[str]:
    """
    Embeds all chunks and stores them in Qdrant.

    Args:
        connection_id: UUID of the connection — used as a filter field
        chunks: list of {text, metadata} dicts from chunker.py

    Returns:
        List of Qdrant point IDs (UUIDs) assigned to each chunk.
    """
    if not chunks:
        return []

    client = get_qdrant_client()
    ensure_collection(client)

    # Delete existing vectors for this connection (clean re-sync)
    client.delete(
        collection_name=QDRANT_COLLECTION,
        points_selector=Filter(
            must=[FieldCondition(key="connection_id", match=MatchValue(value=connection_id))]
        ),
    )

    # Embed all chunk texts (batched)
    texts = [c["text"] for c in chunks]
    vectors = await embed_texts(texts)

    # Build Qdrant points
    point_ids = []
    points = []
    for chunk, vector in zip(chunks, vectors):
        point_id = str(uuid.uuid4())
        point_ids.append(point_id)
        points.append(PointStruct(
            id=point_id,
            vector=vector,
            payload={
                "connection_id": connection_id,
                **chunk["metadata"],
                "text": chunk["text"],    # store text for debugging / display
            }
        ))

    # Upsert in batches
    for i in range(0, len(points), BATCH_SIZE):
        client.upsert(
            collection_name=QDRANT_COLLECTION,
            points=points[i : i + BATCH_SIZE],
        )

    return point_ids


# ── Retrieve relevant chunks ──────────────────────────────────

async def search_schema(
    question: str,
    connection_id: str,
    top_k: int = 8,
    allowed_tables: list[str] | None = None,
) -> list[dict]:
    """
    Embeds the user's question and searches Qdrant for the
    most relevant schema chunks for a specific connection.

    Args:
        question: The user's natural language question
        connection_id: Limit search to this connection's schema
        top_k: Number of chunks to retrieve
        allowed_tables: If provided, restrict search to these table names only
                        (used for per-team schema access control)

    Returns:
        List of chunk payloads (metadata + text), sorted by relevance.
    """
    client = get_qdrant_client()
    question_vector = await embed_single(question)

    # Always filter by connection_id; optionally add team table restriction
    must_conditions: list = [
        FieldCondition(key="connection_id", match=MatchValue(value=connection_id))
    ]

    if allowed_tables:
        # Only search schema chunks belonging to the team's allowed tables
        must_conditions.append(
            Filter(
                should=[
                    FieldCondition(key="table", match=MatchValue(value=t))
                    for t in allowed_tables
                ]
            )
        )

    results = client.search(
        collection_name=QDRANT_COLLECTION,
        query_vector=question_vector,
        query_filter=Filter(must=must_conditions),
        limit=top_k,
        with_payload=True,
    )

    return [hit.payload for hit in results]


async def delete_connection_vectors(connection_id: str) -> None:
    """Deletes all vectors for a connection (called on connection delete)."""
    client = get_qdrant_client()
    client.delete(
        collection_name=QDRANT_COLLECTION,
        points_selector=Filter(
            must=[FieldCondition(key="connection_id", match=MatchValue(value=connection_id))]
        ),
    )