alter table public.projects enable row level security;
alter table public.knowledge enable row level security;
alter table public.tags enable row level security;
alter table public.knowledge_tags enable row level security;
alter table public.knowledge_embeddings enable row level security;
alter table public.code_references enable row level security;

create policy "own projects" on public.projects
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own knowledge" on public.knowledge
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own tags" on public.tags
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own knowledge_tags" on public.knowledge_tags
  for all
  using (
    exists (
      select 1 from public.knowledge k
      where k.id = knowledge_id and k.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.knowledge k
      where k.id = knowledge_id and k.user_id = auth.uid()
    )
  );

create policy "own embeddings" on public.knowledge_embeddings
  for all
  using (
    exists (
      select 1 from public.knowledge k
      where k.id = knowledge_id and k.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.knowledge k
      where k.id = knowledge_id and k.user_id = auth.uid()
    )
  );

create policy "own code_references" on public.code_references
  for all
  using (
    exists (
      select 1 from public.knowledge k
      where k.id = knowledge_id and k.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.knowledge k
      where k.id = knowledge_id and k.user_id = auth.uid()
    )
  );

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.projects, public.knowledge, public.tags,
  public.knowledge_tags, public.knowledge_embeddings, public.code_references to authenticated;
grant select, insert, update, delete on public.projects, public.knowledge, public.tags,
  public.knowledge_tags, public.knowledge_embeddings, public.code_references to anon;
grant all privileges on all tables in schema public to service_role;
