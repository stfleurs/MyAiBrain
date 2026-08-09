create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid(),
  name text not null,
  slug text not null unique,
  description text,
  repository_url text,
  tech_stack text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'archived', 'maintained')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index projects_user_id_slug_key on public.projects (user_id, slug);
