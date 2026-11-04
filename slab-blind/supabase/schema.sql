-- 슬랩 블라인드 · Supabase 설정
-- Supabase 대시보드 → SQL Editor → New query 에 이 파일 전체를 붙여 넣고 Run 하세요.
-- 맨 아래 'YOUR_EMAIL@example.com' 을 운영자 이메일로 바꾼 뒤 실행하세요.

------------------------------------------------------------
-- 1. 운영자 목록 (검토 페이지에 로그인할 수 있는 사람)
------------------------------------------------------------
create table if not exists public.admins (
  email text primary key
);
alter table public.admins enable row level security;
-- 정책 없음: 아무도 앱에서 읽거나 쓸 수 없고, SQL 로만 관리합니다.

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where email = (auth.jwt() ->> 'email'));
$$;

------------------------------------------------------------
-- 2. 카드 (문제 풀)
------------------------------------------------------------
create table if not exists public.cards (
  id          uuid primary key default gen_random_uuid(),
  front_path  text not null,
  back_path   text not null,
  company     text not null check (company in ('PSA','CGC','BRG')),
  grade       numeric(3,1) not null check (grade >= 1 and grade <= 10),
  pristine    boolean not null default false,
  tier        smallint not null default 1 check (tier between 0 and 2),
  box         jsonb not null,
  name        text not null default '' check (char_length(name) <= 60),
  cond        text not null default '' check (char_length(cond) <= 300),
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitter   text not null default '' check (char_length(submitter) <= 64),
  created_at  timestamptz not null default now()
);
alter table public.cards enable row level security;

drop policy if exists "anyone reads approved cards" on public.cards;
create policy "anyone reads approved cards" on public.cards
  for select to anon, authenticated using (status = 'approved' or public.is_admin());

drop policy if exists "anyone submits pending cards" on public.cards;
create policy "anyone submits pending cards" on public.cards
  for insert to anon, authenticated
  with check (status = 'pending' and front_path like 'pending/%' and back_path like 'pending/%');

drop policy if exists "admins update cards" on public.cards;
create policy "admins update cards" on public.cards
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins delete cards" on public.cards;
create policy "admins delete cards" on public.cards
  for delete to authenticated using (public.is_admin());

------------------------------------------------------------
-- 3. 랭킹
------------------------------------------------------------
create table if not exists public.scores (
  player_id   text primary key check (char_length(player_id) between 8 and 64),
  best        integer not null check (best between 0 and 100000),
  streak      integer not null default 0,
  start_level smallint not null default 0,
  updated_at  timestamptz not null default now()
);
alter table public.scores enable row level security;

drop policy if exists "anyone reads scores" on public.scores;
create policy "anyone reads scores" on public.scores
  for select to anon, authenticated using (true);
-- 직접 쓰기는 막고, 아래 함수로만 기록합니다 (최고 기록보다 높을 때만 갱신).

create or replace function public.submit_score(p_player text, p_score int, p_streak int, p_start int)
returns integer
language plpgsql security definer set search_path = public
as $$
declare cur int;
begin
  if p_player is null or char_length(p_player) < 8 or char_length(p_player) > 64 then raise exception 'bad player'; end if;
  if p_score < 0 or p_score > 100000 or p_streak < 0 or p_start not between 0 and 2 then raise exception 'bad score'; end if;
  -- 한 문제당 최대 점수(상급 40 + 시간 보너스 25)를 넘는 기록은 거절
  if p_score > (p_streak * 65) then raise exception 'impossible score'; end if;
  insert into public.scores(player_id, best, streak, start_level, updated_at)
  values (p_player, p_score, p_streak, p_start, now())
  on conflict (player_id) do update
    set best = excluded.best, streak = excluded.streak, start_level = excluded.start_level, updated_at = now()
    where public.scores.best < excluded.best;
  select best into cur from public.scores where player_id = p_player;
  return cur;
end;
$$;
grant execute on function public.submit_score(text,int,int,int) to anon, authenticated;

-- 랭킹 실시간 갱신
do $$ begin
  alter publication supabase_realtime add table public.scores;
exception when duplicate_object then null; end $$;

------------------------------------------------------------
-- 4. 사진 저장소 (공개 읽기, 업로드는 pending/ 폴더에만, 400KB 이하 JPEG)
------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cards', 'cards', true, 409600, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 409600, allowed_mime_types = array['image/jpeg'];

drop policy if exists "anyone uploads pending images" on storage.objects;
create policy "anyone uploads pending images" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'cards' and (storage.foldername(name))[1] = 'pending');

drop policy if exists "admins delete images" on storage.objects;
create policy "admins delete images" on storage.objects
  for delete to authenticated using (bucket_id = 'cards' and public.is_admin());

------------------------------------------------------------
-- 5. 운영자 등록  ← 이메일을 바꾸세요
------------------------------------------------------------
insert into public.admins(email) values ('YOUR_EMAIL@example.com') on conflict do nothing;
