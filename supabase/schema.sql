-- CicloSeguro Lima - Esquema PostgreSQL (Supabase) con Row Level Security (RLS).
-- Ejecutar completo en Supabase > SQL Editor. Es idempotente para un proyecto nuevo.

-- ===================== TABLAS =====================
create table if not exists districts (
  name text primary key
);

create table if not exists routes (
  id          bigint generated always as identity primary key,
  name        text not null,
  lane_type   text not null check (lane_type in ('segregada','senalizada','compartida')),
  condition   text not null check (condition in ('bueno','regular','malo','invadido')),
  districts   text[] not null,
  coords      jsonb not null              -- [[lat,lng], ...]
);

create table if not exists incidents (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type        text not null check (type in ('robo','accidente','invasion','mal_estado')),
  district    text references districts(name),
  lat         double precision not null check (lat between -12.30 and -11.75),
  lng         double precision not null check (lng between -77.20 and -76.80),
  description text not null check (char_length(description) between 10 and 300),
  status      text not null default 'publicado' check (status in ('publicado','oculto')),
  created_at  timestamptz not null default now()
);

create table if not exists confirmations (
  incident_id bigint not null references incidents(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (incident_id, user_id)       -- una confirmación por usuario (US-09)
);

create table if not exists parkings (
  id           bigint generated always as identity primary key,
  name         text not null,
  district     text references districts(name),
  lat          double precision not null,
  lng          double precision not null,
  surveillance boolean not null default false,
  covered      boolean not null default false,
  capacity     int not null check (capacity >= 0),
  fee          text not null default 'Gratis'
);

create table if not exists ratings (
  parking_id bigint not null references parkings(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  stars      int not null check (stars between 1 and 5),   -- US-13
  created_at timestamptz not null default now(),
  primary key (parking_id, user_id)
);

-- ===================== VISTAS DE LECTURA =====================
-- No exponen user_id (privacidad de quien reporta).
create or replace view incidents_public with (security_invoker = true) as
  select i.id, i.type, i.district, i.lat, i.lng, i.description, i.status, i.created_at,
         (select count(*) from confirmations c where c.incident_id = i.id) as confirmations
  from incidents i where i.status = 'publicado';

create or replace view parkings_public with (security_invoker = true) as
  select p.*, coalesce((select array_agg(r.stars) from ratings r where r.parking_id = p.id), '{}') as ratings
  from parkings p;

-- ===================== SEGURIDAD: RLS (US-17) =====================
alter table districts     enable row level security;
alter table routes        enable row level security;
alter table incidents     enable row level security;
alter table confirmations enable row level security;
alter table parkings      enable row level security;
alter table ratings       enable row level security;

-- Lectura pública (cualquiera puede ver el mapa)
create policy "leer distritos"        on districts     for select using (true);
create policy "leer rutas"            on routes        for select using (true);
create policy "leer incidentes"       on incidents     for select using (status = 'publicado');
create policy "leer confirmaciones"   on confirmations for select using (true);
create policy "leer estacionamientos" on parkings      for select using (true);
create policy "leer calificaciones"   on ratings       for select using (true);

-- Escritura solo para usuarios autenticados y siempre a su propio nombre
create policy "crear incidente propio"    on incidents     for insert to authenticated with check (user_id = auth.uid() and status = 'publicado');
create policy "confirmar como yo"         on confirmations for insert to authenticated with check (user_id = auth.uid());
create policy "calificar como yo"         on ratings       for insert to authenticated with check (user_id = auth.uid());
create policy "cambiar mi calificación"   on ratings       for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- Rutas, distritos y estacionamientos solo se modifican desde el panel de Supabase (rol service_role).

-- Permisos mínimos para la API (principio de menor privilegio). RLS filtra además fila por fila.
grant usage on schema public to anon, authenticated;
grant select on districts, routes, incidents, confirmations, parkings, ratings, incidents_public, parkings_public to anon, authenticated;
grant insert on incidents, confirmations, ratings to authenticated;
grant update (parking_id, stars) on ratings to authenticated;

-- ===================== DATOS DE PRUEBA =====================
insert into districts(name) values
 ('Barranco'),('Jesús María'),('Lima'),('Lince'),('Magdalena'),('Miraflores'),('San Borja'),('San Isidro'),('Santiago de Surco')
on conflict do nothing;

insert into routes(name, lane_type, condition, districts, coords) values
 ('Ciclovía Av. Arequipa','segregada','bueno', array['Lima','Lince','San Isidro','Miraflores'],
  '[[-12.0600,-77.0370],[-12.0800,-77.0340],[-12.0950,-77.0330],[-12.1100,-77.0310],[-12.1190,-77.0295]]'),
 ('Ciclovía Av. Salaverry','segregada','regular', array['Jesús María','Magdalena','San Isidro'],
  '[[-12.0700,-77.0510],[-12.0830,-77.0520],[-12.0960,-77.0530]]'),
 ('Ciclovía Malecón / Costa Verde','senalizada','bueno', array['Miraflores','Barranco'],
  '[[-12.1210,-77.0390],[-12.1290,-77.0340],[-12.1400,-77.0280],[-12.1500,-77.0270]]'),
 ('Ciclovía Av. Javier Prado','senalizada','invadido', array['San Isidro','San Borja'],
  '[[-12.0910,-77.0420],[-12.0910,-77.0300],[-12.0890,-77.0180],[-12.0880,-77.0050]]'),
 ('Ciclovía Av. Benavides','compartida','malo', array['Miraflores','Santiago de Surco'],
  '[[-12.1190,-77.0240],[-12.1260,-77.0100],[-12.1320,-76.9950]]');

insert into parkings(name, district, lat, lng, surveillance, covered, capacity, fee) values
 ('Parque Kennedy (zona vigilada)','Miraflores',-12.1219,-77.0297,true,false,30,'Gratis'),
 ('Larcomar','Miraflores',-12.1313,-77.0301,true,true,60,'S/ 2 por hora'),
 ('Parque El Olivar','San Isidro',-12.0990,-77.0365,true,false,20,'Gratis'),
 ('Estación Javier Prado','San Isidro',-12.0909,-77.0334,false,true,40,'Gratis'),
 ('Plaza de Barranco','Barranco',-12.1496,-77.0210,true,false,25,'Gratis');

-- Incidentes de prueba: se crean a nombre del primer usuario registrado (regístrate en la app antes de ejecutar este bloque).
insert into incidents(user_id, type, district, lat, lng, description, created_at)
select u.id, v.type, v.district, v.lat, v.lng, v.description, now() - (v.days || ' days')::interval
from (select id from auth.users order by created_at limit 1) u,
(values
 ('robo','Miraflores',-12.1150,-77.0305,'Robo de celular a ciclista cerca del óvalo, de noche.',3),
 ('robo','Miraflores',-12.1180,-77.0298,'Intentaron llevarse la bicicleta amarrada afuera de un local.',6),
 ('invasion','San Isidro',-12.0910,-77.0300,'Autos estacionados sobre la ciclovía durante todo el día.',1),
 ('mal_estado','Santiago de Surco',-12.1260,-77.0100,'Hueco grande y pista rota en el carril de bicicletas.',9),
 ('accidente','San Isidro',-12.0950,-77.0331,'Choque entre ciclista y auto al cruzar la avenida.',12),
 ('mal_estado','Magdalena',-12.0830,-77.0521,'Tramo con baches y sin señalización en el carril.',20),
 ('invasion','Lince',-12.0800,-77.0341,'Motos circulando por la ciclovía a toda velocidad.',2)
) as v(type, district, lat, lng, description, days);
