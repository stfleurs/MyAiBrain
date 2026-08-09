create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  unique (user_id, name)
);

create table public.knowledge_tags (
  knowledge_id uuid not null references public.knowledge (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (knowledge_id, tag_id)
);

create index knowledge_tags_tag_id_idx on public.knowledge_tags (tag_id);
