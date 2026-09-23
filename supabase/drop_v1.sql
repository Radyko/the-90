-- One-time cleanup: removes the v1 two-person board objects (they held no real data).
-- Run once in the Supabase SQL editor BEFORE schema.sql. Safe if they're already gone.
drop function if exists public.create_board(text, date, text);
drop function if exists public.join_board(text, text, date, text);
drop table if exists public.participants cascade;
drop table if exists public.boards cascade;
drop function if exists public.is_board_member(uuid);
drop function if exists public.touch_updated_at();
