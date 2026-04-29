create table if not exists public.chat_banned_words (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  created_at timestamptz not null default timezone('utc', now()),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.chat_banned_words
  add constraint chat_banned_words_word_unique unique (word);

comment on table public.chat_banned_words is 'Liste des mots bannis pour la modération du chat.';

alter table public.chat_banned_words enable row level security;

create policy "Admins manage chat banned words"
  on public.chat_banned_words
  for all
  to authenticated
  using (exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  ))
  with check (exists (
    select 1
    from public.admins a
    where a.user_id = auth.uid()
  ));;
