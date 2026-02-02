create extension if not exists pgcrypto;

create table if not exists pending_routes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending',
  payload jsonb not null,
  error text
);

create index if not exists pending_routes_status_created_at_idx
  on pending_routes (status, created_at);

create table if not exists vehicles (
  id text primary key,
  capacity_weight numeric not null,
  capacity_volume numeric not null,
  skills jsonb not null default '[]'::jsonb
);

create table if not exists optimized_routes (
  id uuid primary key default gen_random_uuid(),
  pending_route_id uuid not null references pending_routes(id) on delete cascade,
  created_at timestamptz not null default now(),
  status text not null,
  result jsonb not null
);

create index if not exists optimized_routes_pending_route_id_created_at_idx
  on optimized_routes (pending_route_id, created_at desc);
