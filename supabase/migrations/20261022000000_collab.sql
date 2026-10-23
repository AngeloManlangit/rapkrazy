-- Collab (multiplayer) tables. Players sign in anonymously, so auth.uid() is their temporary id.
-- Turn on "Anonymous sign-ins" in Supabase: Authentication > Sign In / Providers.

create table if not exists public.rooms (
  code text primary key,
  host_id uuid not null,
  beat_id text,
  status text not null default 'lobby' check (status in ('lobby', 'writing', 'reveal')),
  turn_index int not null default 0,
  total_turns int not null default 0,
  turn_seconds int not null default 45 check (turn_seconds between 10 and 180),
  rounds int not null default 2 check (rounds between 1 and 4),
  turn_deadline timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.room_players (
  room_code text not null references public.rooms (code) on delete cascade,
  player_id uuid not null,
  name text not null check (char_length(name) between 1 and 20),
  seat int not null,
  primary key (room_code, player_id),
  unique (room_code, seat)
);

create table if not exists public.room_lines (
  room_code text not null references public.rooms (code) on delete cascade,
  turn_index int not null,
  player_id uuid not null,
  text text not null check (char_length(text) between 1 and 140),
  created_at timestamptz not null default now(),
  primary key (room_code, turn_index)
);

-- Is the signed-in user seated in this room? security definer avoids policy recursion.
create or replace function public.is_room_member(p_code text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from room_players where room_code = p_code and player_id = auth.uid());
$$;

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.room_lines enable row level security;

create policy "members read room" on public.rooms for select using (public.is_room_member(code));
create policy "members update room" on public.rooms for update using (public.is_room_member(code));

create policy "members read players" on public.room_players for select using (public.is_room_member(room_code));
create policy "leave room" on public.room_players for delete using (player_id = auth.uid());

create policy "members read lines" on public.room_lines for select using (public.is_room_member(room_code));
create policy "members write lines" on public.room_lines for insert with check (public.is_room_member(room_code));
create policy "members clear lines" on public.room_lines for delete using (public.is_room_member(room_code));

-- Make a room and sit the host in seat 0. Returns the 6-letter code.
create or replace function public.create_room(p_name text, p_turn_seconds int default 45, p_rounds int default 2)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_try int := 0;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  loop
    v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ', 1 + floor(random() * 24)::int, 1), '')
               from generate_series(1, 6));
    exit when not exists (select 1 from rooms where code = v_code);
    v_try := v_try + 1;
    if v_try > 20 then raise exception 'Could not make a code'; end if;
  end loop;
  insert into rooms (code, host_id, turn_seconds, rounds) values (v_code, auth.uid(), p_turn_seconds, p_rounds);
  insert into room_players (room_code, player_id, name, seat) values (v_code, auth.uid(), left(trim(p_name), 20), 0);
  return v_code;
end $$;

-- Sit in a room (max 5 players, only before the game starts). Safe to call again.
create or replace function public.join_room(p_code text, p_name text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(p_code));
  v_room rooms;
  v_seat int;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into v_room from rooms where code = v_code for update;
  if not found then raise exception 'No lobby with that code'; end if;
  if exists (select 1 from room_players where room_code = v_code and player_id = auth.uid()) then return; end if;
  if v_room.status <> 'lobby' then raise exception 'That game already started'; end if;
  if (select count(*) from room_players where room_code = v_code) >= 5 then raise exception 'Lobby is full'; end if;
  select coalesce(max(seat) + 1, 0) into v_seat from room_players where room_code = v_code;
  insert into room_players (room_code, player_id, name, seat) values (v_code, auth.uid(), left(trim(p_name), 20), v_seat);
end $$;

grant execute on function public.create_room(text, int, int) to authenticated;
grant execute on function public.join_room(text, text) to authenticated;

-- Live updates for the game screens.
alter publication supabase_realtime add table public.rooms, public.room_players, public.room_lines;
