# Configurar Neon

## 1. Conéctate a Neon
Usa el Neon SQL Editor o psql:
```bash
psql 'postgresql://neondb_owner:npg_ovJB0U4KWyHI@ep-twilight-darkness-aivktlz7-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
```

## 2. Ejecuta el schema
Copia y pega el contenido de backend/schema.sql en el editor SQL:

```sql
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
```

## 3. (Opcional) Agrega vehículos de ejemplo
```sql
insert into vehicles (id, capacity_weight, capacity_volume, skills) values
('VAN-1', 800, 4, '["refrigerado"]'),
('TRUCK-1', 4000, 20, '["camion_grande"]');
```

## 4. Verifica
```sql
select * from vehicles;
```
