-- FlipStudio Supabase Schema v2
-- Paste this into Supabase SQL Editor and run it

create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text,
  avatar_url text default '',
  bio text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
          coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end;$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create table if not exists public.projects (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text default '',
  width integer not null default 1080,
  height integer not null default 1080,
  fps integer not null default 12,
  background_color text not null default '#ffffff',
  thumbnail text default '',
  is_public boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.projects enable row level security;
create policy "projects_owner" on public.projects using (auth.uid() = owner_id);
create policy "projects_public_select" on public.projects for select using (is_public = true);

create table if not exists public.project_collaborators (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text not null default 'editor' check (role in ('viewer','editor','admin')),
  joined_at timestamptz default now(),
  unique(project_id, user_id)
);
alter table public.project_collaborators enable row level security;
create policy "collab_select" on public.project_collaborators for select using (auth.uid() = user_id or
  exists(select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));
create policy "collab_manage" on public.project_collaborators
  using (exists(select 1 from public.projects p where p.id = project_id and p.owner_id = auth.uid()));

create table if not exists public.frames (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  frame_order integer not null default 0,
  duration_ms integer not null default 83,
  thumbnail text default '',
  created_at timestamptz default now()
);
alter table public.frames enable row level security;
create policy "frames_access" on public.frames using (
  exists(select 1 from public.projects p where p.id = project_id
    and (p.owner_id = auth.uid() or p.is_public
      or exists(select 1 from public.project_collaborators c where c.project_id = p.id and c.user_id = auth.uid()))));

create table if not exists public.layers (
  id uuid default uuid_generate_v4() primary key,
  frame_id uuid references public.frames(id) on delete cascade not null,
  project_id uuid references public.projects(id) on delete cascade not null,
  name text not null default 'Layer 1',
  layer_order integer not null default 0,
  visible boolean not null default true,
  locked boolean not null default false,
  opacity integer not null default 100,
  blend_mode text not null default 'normal',
  canvas_data text not null default '{"strokes":[]}',
  updated_at timestamptz default now()
);
alter table public.layers enable row level security;
create policy "layers_access" on public.layers using (
  exists(select 1 from public.projects p where p.id = project_id
    and (p.owner_id = auth.uid() or p.is_public
      or exists(select 1 from public.project_collaborators c where c.project_id = p.id and c.user_id = auth.uid()))));

create table if not exists public.live_cursors (
  project_id uuid references public.projects(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  username text,
  cursor_color text default '#7c3aed',
  frame_index integer default 0,
  x float default 0,
  y float default 0,
  last_seen timestamptz default now(),
  primary key(project_id, user_id)
);
alter table public.live_cursors enable row level security;
create policy "cursors_all" on public.live_cursors using (auth.uid() = user_id or
  exists(select 1 from public.project_collaborators c where c.project_id = project_id and c.user_id = auth.uid()));

alter publication supabase_realtime add table public.live_cursors;
alter publication supabase_realtime add table public.layers;
