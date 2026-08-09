create table public.knowledge (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  project_id uuid references public.projects (id) on delete set null,
  type text not null check (
    type in (
      'architecture',
      'decision',
      'pattern',
      'bug_fix',
      'template',
      'lesson',
      'configuration',
      'deployment',
      'feature'
    )
  ),
  title text not null,
  content text not null,
  summary text,
  source text,
  importance smallint not null default 3 check (importance between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_user_id_idx on public.knowledge (user_id);
create index knowledge_project_id_idx on public.knowledge (project_id);
create index knowledge_type_idx on public.knowledge (type);
