create index knowledge_search_idx on public.knowledge using gin (
  to_tsvector('english', title || ' ' || coalesce(summary, '') || ' ' || content)
);

create index knowledge_embeddings_embedding_idx
  on public.knowledge_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);
