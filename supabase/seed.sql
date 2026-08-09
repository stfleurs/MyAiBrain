-- Idempotent seed for development.
-- Creates a demo user (demo@local.dev / demo-password) and assigns sample
-- projects and knowledge to that account. Safe to run repeatedly.

-- Demo user
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, phone,
  phone_change_token, is_super_admin, is_sso_user, is_anonymous,
  confirmation_sent_at, recovery_sent_at, email_change_sent_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'demo@local.dev',
  crypt('demo-password', gen_salt('bf')),
  now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(), now(), null,
  '', false, false, false,
  now(), now(), now()
)
on conflict (id) do nothing;

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at,
  updated_at, id
) values (
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"demo@local.dev","email_verified":true,"phone_verified":false}'::jsonb,
  'email', now(), now(), now(),
  '00000000-0000-0000-0000-000000000001'
)
on conflict (provider, provider_id) do nothing;

-- Projects
insert into public.projects (id, user_id, name, slug, description, repository_url, tech_stack, status) values
  ('00000000-0000-0000-0000-000000000101', '00000000-0000-0000-0000-000000000001',
   'Vendrex', 'vendrex', 'Multi-currency commerce app for store owners.',
   'https://github.com/stfleurs/vendrex',
   array['flutter', 'firestore', 'revenuecat'], 'active'),
  ('00000000-0000-0000-0000-000000000102', '00000000-0000-0000-0000-000000000001',
   'Tally Cart', 'tally-cart', 'Shopping cart with price history tracking.',
   'https://github.com/stfleurs/tally-cart',
   array['flutter', 'firestore', 'ad-mob'], 'active'),
  ('00000000-0000-0000-0000-000000000103', '00000000-0000-0000-0000-000000000001',
   'Monetix', 'monetix', 'Ad mediation layer as a reusable Flutter package.',
   'https://github.com/stfleurs/monetix',
   array['flutter', 'mediation', 'ad-mob'], 'active'),
  ('00000000-0000-0000-0000-000000000104', '00000000-0000-0000-0000-000000000001',
   'BoyoMart', 'boyomart', 'Marketplace app for kids products.',
   'https://github.com/stfleurs/boyomart',
   array['flutter', 'firestore'], 'maintained'),
  ('00000000-0000-0000-0000-000000000105', '00000000-0000-0000-0000-000000000001',
   'VeganSandy', 'vegansandy', 'Vegan product discovery and reviews.',
   'https://github.com/stfleurs/vegansandy',
   array['flutter', 'firestore'], 'archived')
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  description = excluded.description,
  repository_url = excluded.repository_url,
  tech_stack = excluded.tech_stack,
  status = excluded.status;

-- Knowledge
insert into public.knowledge (
  id, user_id, project_id, type, title, content, summary, source, importance
) values
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    'bug_fix',
    'Persistent Firestore stream timeout',
    'A 15-second timeout was applied to a persistent receipt Firestore stream. Once the timeout generated an error, the StreamBuilder remained in an error state and did not recover.\n\nResolution: Remove the timeout from the persistent stream and provide explicit retry handling for actual failures.',
    'Timeout on a persistent Firestore stream left the UI in a permanent error state.',
    'manual',
    4
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000101',
    'architecture',
    'RevenueCat identity architecture',
    'The RevenueCat App User ID should be associated with the authenticated owner account rather than the store ID, because an owner can have multiple stores.\n\nSubscriptions are keyed to the owner account so entitlements follow the user across stores.',
    'Associate RevenueCat App User ID with the owner account, not the store.',
    'manual',
    5
  ),
  (
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000103',
    'pattern',
    'Ad mediation fallback chain',
    'Monetix tries ad networks in order and falls back to the next provider when a fill fails. Rewarded ads must fall back to a no-op reward callback so user flows never dead-end.',
    'Mediation with graceful fallback and no-op reward callbacks.',
    'manual',
    3
  )
on conflict (id) do update set
  project_id = excluded.project_id,
  type = excluded.type,
  title = excluded.title,
  content = excluded.content,
  summary = excluded.summary,
  source = excluded.source,
  importance = excluded.importance;

-- Tags
insert into public.tags (id, user_id, name) values
  ('00000000-0000-0000-0000-000000000301', '00000000-0000-0000-0000-000000000001', 'firebase'),
  ('00000000-0000-0000-0000-000000000302', '00000000-0000-0000-0000-000000000001', 'firestore'),
  ('00000000-0000-0000-0000-000000000303', '00000000-0000-0000-0000-000000000001', 'flutter'),
  ('00000000-0000-0000-0000-000000000304', '00000000-0000-0000-0000-000000000001', 'streams'),
  ('00000000-0000-0000-0000-000000000305', '00000000-0000-0000-0000-000000000001', 'revenuecat'),
  ('00000000-0000-0000-0000-000000000306', '00000000-0000-0000-0000-000000000001', 'subscriptions'),
  ('00000000-0000-0000-0000-000000000307', '00000000-0000-0000-0000-000000000001', 'testing'),
  ('00000000-0000-0000-0000-000000000308', '00000000-0000-0000-0000-000000000001', 'ad-mob'),
  ('00000000-0000-0000-0000-000000000309', '00000000-0000-0000-0000-000000000001', 'mediation')
on conflict (id) do update set name = excluded.name;

insert into public.knowledge_tags (knowledge_id, tag_id) values
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000302'),
  ('00000000-0000-0000-0000-000000000201', '00000000-0000-0000-0000-000000000304'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000305'),
  ('00000000-0000-0000-0000-000000000202', '00000000-0000-0000-0000-000000000306'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000308'),
  ('00000000-0000-0000-0000-000000000203', '00000000-0000-0000-0000-000000000309')
on conflict (knowledge_id, tag_id) do nothing;
