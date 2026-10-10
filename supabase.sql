-- 魔法の旅のしおり: 4人で同期するためのテーブルと写真置き場
-- Supabase の SQL Editor に全部貼って Run してください（何回実行しても大丈夫です）

-- 1) 状態を「部屋（合言葉）× 項目」ごとに 1 行で持つ
create table if not exists public.trip_kv (
  room       text        not null,
  key        text        not null,
  value      jsonb,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (room, key)
);

alter table public.trip_kv enable row level security;

-- ログイン無しで使うので anon に読み書きを許可（合言葉を知っている人だけが同じ部屋を開く想定）
drop policy if exists "trip read"   on public.trip_kv;
drop policy if exists "trip insert" on public.trip_kv;
drop policy if exists "trip update" on public.trip_kv;
create policy "trip read"   on public.trip_kv for select to anon using (true);
create policy "trip insert" on public.trip_kv for insert to anon with check (char_length(room) between 6 and 64);
create policy "trip update" on public.trip_kv for update to anon using (true) with check (char_length(room) between 6 and 64);

-- 更新時刻はサーバーの時計で付ける（スマホの時計のずれに左右されないように）
create or replace function public.trip_kv_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists trip_kv_touch on public.trip_kv;
create trigger trip_kv_touch before insert or update on public.trip_kv
  for each row execute function public.trip_kv_touch();

-- 2) 変更をリアルタイムで配る
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trip_kv'
  ) then
    alter publication supabase_realtime add table public.trip_kv;
  end if;
end $$;

-- 3) 写真・動画の置き場（公開バケット、1 ファイル 50MB まで）
insert into storage.buckets (id, name, public, file_size_limit)
values ('trip', 'trip', true, 52428800)
on conflict (id) do update set public = true, file_size_limit = 52428800;

drop policy if exists "trip upload" on storage.objects;
create policy "trip upload" on storage.objects for insert to anon
  with check (bucket_id = 'trip');
