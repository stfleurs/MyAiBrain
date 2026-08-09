create table public.knowledge_embeddings (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid not null references public.knowledge (id) on delete cascade,
  embedding vector(1536),
  model text not null,
  created_at timestamptz not null default now(),
  unique (knowledge_id, model)
);
