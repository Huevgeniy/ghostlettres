/*
# Create Ghost Letters rooms and players

1. New Tables
- `game_rooms` stores one shared room with its join code, host, settings, current phase, and JSON game state.
- `game_players` stores the nickname, role, hand, submitted clue, and readiness for each player in a room.
2. Security
- Row level security is enabled on both tables.
- This is intentionally a no-sign-in party game: anon and authenticated clients may access shared room data so friends can join with a code.
- Four separate CRUD policies are defined for each table.
3. Important notes
- A room's complete mutable game state is stored in JSONB so the game can evolve without destroying existing rooms.
- Players are scoped to a room through `room_id` and can be added or updated by the shared game client.
*/

CREATE TABLE IF NOT EXISTS public.game_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  host_name text NOT NULL,
  player_count integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  phase text NOT NULL DEFAULT 'lobby',
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.game_rooms(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  role text,
  hand jsonb NOT NULL DEFAULT '[]'::jsonb,
  submitted_clue jsonb,
  is_ready boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_players_room_id_idx ON public.game_players(room_id);
CREATE INDEX IF NOT EXISTS game_rooms_code_idx ON public.game_rooms(code);

ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_game_rooms" ON public.game_rooms;
CREATE POLICY "public_read_game_rooms" ON public.game_rooms FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public_insert_game_rooms" ON public.game_rooms;
CREATE POLICY "public_insert_game_rooms" ON public.game_rooms FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "public_update_game_rooms" ON public.game_rooms;
CREATE POLICY "public_update_game_rooms" ON public.game_rooms FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "public_delete_game_rooms" ON public.game_rooms;
CREATE POLICY "public_delete_game_rooms" ON public.game_rooms FOR DELETE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "public_read_game_players" ON public.game_players;
CREATE POLICY "public_read_game_players" ON public.game_players FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public_insert_game_players" ON public.game_players;
CREATE POLICY "public_insert_game_players" ON public.game_players FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "public_update_game_players" ON public.game_players;
CREATE POLICY "public_update_game_players" ON public.game_players FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "public_delete_game_players" ON public.game_players;
CREATE POLICY "public_delete_game_players" ON public.game_players FOR DELETE TO anon, authenticated USING (true);
