create table public.code_references (
  id uuid primary key default gen_random_uuid(),
  knowledge_id uuid not null references public.knowledge (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  repository text,
  file_path text not null,
  symbol text,
  line_start integer,
  line_end integer,
  commit_sha text,
  url text,
  created_at timestamptz not null default now()
);

create index code_references_knowledge_id_idx on public.code_references (knowledge_id);
create index code_references_file_path_idx on public.code_references (file_path);
