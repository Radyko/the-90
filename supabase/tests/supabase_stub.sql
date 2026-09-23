-- Minimal stand-in for the parts of Supabase the schema relies on, so the schema can be
-- tested against plain Postgres. auth.uid() reads the `request.jwt.claim.sub` setting.
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- Supabase's default privileges (the schema must revoke these itself)
alter default privileges in schema public grant all on tables to anon, authenticated;
alter default privileges in schema public grant execute on functions to anon, authenticated;
set client_min_messages = warning;
create publication supabase_realtime;
