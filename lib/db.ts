import postgres from 'postgres';

const g = globalThis as unknown as { __sql?: postgres.Sql; __schema?: Promise<void> };

const sql: postgres.Sql =
  g.__sql ??
  (g.__sql = postgres(process.env.DATABASE_URL ?? '', {
    ssl: process.env.DATABASE_SSL === 'false' ? false : 'require',
    max: 3,
    prepare: false,
    idle_timeout: 20,
  }));

const SCHEMA = `
create table if not exists offers (
  id serial primary key,
  dedupe_key text unique not null,
  title text not null,
  company text not null default '',
  city text not null default '',
  url text,
  description text not null default '',
  published_at timestamptz,
  expires_at timestamptz,
  first_seen_at timestamptz not null default now(),
  sources jsonb not null default '[]',
  contact_email text,
  lm_required boolean,
  score int,
  summary text,
  analysis jsonb,
  scored_at timestamptz,
  score_attempts int not null default 0,
  status text not null default 'new'
);
create index if not exists offers_status_idx on offers(status, score desc);
create table if not exists applications (
  id serial primary key,
  offer_id int unique not null references offers(id) on delete cascade,
  status text not null default 'draft',
  method text not null default 'mail',
  to_email text, subject text, body text, lm_text text,
  validated_at timestamptz not null default now(),
  scheduled_send_at timestamptz, sent_at timestamptz, follow_up_at timestamptz,
  notes text, error text,
  updated_at timestamptz not null default now()
);
create table if not exists events (
  id serial primary key,
  offer_id int references offers(id) on delete cascade,
  type text not null, detail text,
  at timestamptz not null default now()
);
create table if not exists files (
  name text primary key, mime text not null, filename text,
  data bytea not null, updated_at timestamptz not null default now()
);
create table if not exists settings (key text primary key, value text not null);
create table if not exists runs (
  id serial primary key,
  kind text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz, ok boolean,
  fetched int default 0, inserted int default 0, message text
);
`;

/** Retourne le client SQL après avoir créé le schéma si besoin (une fois par instance). */
export async function db(): Promise<postgres.Sql> {
  if (!g.__schema) {
    g.__schema = sql.unsafe(SCHEMA).then(() => undefined);
    g.__schema.catch(() => { g.__schema = undefined; });
  }
  await g.__schema;
  return sql;
}

export async function getSetting(key: string, fallback: string): Promise<string> {
  const q = await db();
  const [r] = await q`select value from settings where key = ${key}`;
  return r ? (r.value as string) : fallback;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const q = await db();
  await q`insert into settings(key, value) values (${key}, ${value})
          on conflict (key) do update set value = excluded.value`;
}

export async function logEvent(offerId: number, type: string, detail = ''): Promise<void> {
  const q = await db();
  await q`insert into events(offer_id, type, detail) values (${offerId}, ${type}, ${detail})`;
}
