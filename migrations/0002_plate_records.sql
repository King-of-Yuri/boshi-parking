-- Parking records for the plate-recognition lot (unowned; auth is off).
create table if not exists plate_records (
  id            serial primary key,
  plate_number  text not null,
  confidence    double precision not null default 0,
  plate_color   text not null default 'blue',
  enter_time    timestamptz not null default now(),
  exit_time     timestamptz,
  fee           numeric(10, 2) not null default 0,
  image_thumb   text
);

create index if not exists plate_records_plate_idx on plate_records (plate_number);
create index if not exists plate_records_enter_idx on plate_records (enter_time desc);
create index if not exists plate_records_open_idx on plate_records (exit_time) where exit_time is null;

create table if not exists lot_settings (
  id       integer primary key default 1,
  lot_name text not null default '泊识示范停车场',
  capacity integer not null default 80,
  constraint lot_settings_singleton check (id = 1)
);

insert into lot_settings (id, lot_name, capacity)
values (1, '泊识示范停车场', 80)
on conflict (id) do nothing;

-- Demo occupancy + history so the board is alive on first open.
-- Never seed 京A66666 — that plate is reserved for the sample-image test.
insert into plate_records (plate_number, confidence, plate_color, enter_time, exit_time, fee)
values
  ('沪A9P88K', 0.97, 'green',  now() - interval '48 minutes',  null, 0),
  ('粤B23K19', 0.94, 'blue',   now() - interval '2 hours 8 minutes', null, 0),
  ('浙C7182F', 0.91, 'blue',   now() - interval '6 hours 22 minutes', null, 0),
  ('苏E6X201', 0.96, 'blue',   now() - interval '19 minutes', null, 0),
  ('川A88D12', 0.93, 'green',  now() - interval '3 hours 41 minutes', null, 0),
  ('京N30571', 0.89, 'blue',   now() - interval '11 minutes', null, 0),
  ('粤A1J990', 0.95, 'blue',   now() - interval '5 hours 10 minutes', now() - interval '3 hours 4 minutes', 11.00),
  ('沪C40218', 0.92, 'blue',   now() - interval '8 hours 40 minutes', now() - interval '6 hours 5 minutes', 11.00),
  ('京B77821', 0.98, 'yellow', now() - interval '1 day 2 hours', now() - interval '1 day 20 minutes', 14.00),
  ('鲁Q19K33', 0.90, 'blue',   now() - interval '26 hours', now() - interval '24 hours 10 minutes', 11.00),
  ('闽D55017', 0.88, 'blue',   now() - interval '4 hours 50 minutes', now() - interval '70 minutes', 14.00),
  ('湘A60328', 0.93, 'green',  now() - interval '9 hours', now() - interval '7 hours 15 minutes', 11.00),
  ('冀J88216', 0.87, 'blue',   now() - interval '2 days 3 hours', now() - interval '2 days 1 hour', 11.00),
  ('豫H44109', 0.94, 'blue',   now() - interval '3 hours 20 minutes', now() - interval '40 minutes', 14.00),
  ('陕A21980', 0.91, 'blue',   now() - interval '7 hours 5 minutes', now() - interval '5 hours 50 minutes', 8.00),
  ('桂B33051', 0.86, 'blue',   now() - interval '55 minutes', now() - interval '12 minutes', 5.00);
