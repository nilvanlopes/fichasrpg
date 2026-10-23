CREATE TABLE IF NOT EXISTS accounts (
    uid text PRIMARY KEY,
    username text NOT NULL,
    display_name text NOT NULL DEFAULT '',
    last_seen timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sheets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_uid text NOT NULL REFERENCES accounts(uid),
    system text NOT NULL DEFAULT 'mutantes',
    name text NOT NULL DEFAULT '',
    form jsonb NOT NULL DEFAULT '{}'::jsonb,
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sheets_system_check CHECK (system IN ('mutantes', 'vampiro')),
    CONSTRAINT sheets_form_object_check CHECK (jsonb_typeof(form) = 'object')
);

CREATE INDEX IF NOT EXISTS sheets_owner_updated_idx ON sheets (owner_uid, updated_at DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS vampire_disciplines (
    id text PRIMARY KEY,
    name text NOT NULL UNIQUE,
    source_url text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS vampire_discipline_powers (
    id text PRIMARY KEY,
    discipline_id text NOT NULL REFERENCES vampire_disciplines(id),
    name text NOT NULL,
    level integer NOT NULL CHECK (level BETWEEN 1 AND 5),
    description text NOT NULL DEFAULT '',
    details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
    UNIQUE (discipline_id, name)
);

CREATE INDEX IF NOT EXISTS vampire_powers_discipline_level_idx ON vampire_discipline_powers (discipline_id, level, name);
