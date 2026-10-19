CREATE TABLE IF NOT EXISTS accounts (
    uid text PRIMARY KEY,
    username text NOT NULL,
    display_name text NOT NULL DEFAULT '',
    last_seen timestamptz NOT NULL DEFAULT now()
);

-- Keep the original Mutantes rows and assign each one a stable sheet ID.
-- The ALTER statements also make this script safe on a fresh database.
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

ALTER TABLE sheets ADD COLUMN IF NOT EXISTS id uuid;
ALTER TABLE sheets ADD COLUMN IF NOT EXISTS system text NOT NULL DEFAULT 'mutantes';
ALTER TABLE sheets ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
ALTER TABLE sheets ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
UPDATE sheets SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE sheets ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE sheets ALTER COLUMN id SET NOT NULL;
UPDATE sheets SET name = COALESCE(NULLIF(btrim(form->>'nome-personagem'), ''), 'Ficha de Mutantes & Malfeitores')
 WHERE system = 'mutantes' AND btrim(name) = '';

-- The old schema used owner_uid as the primary key (one sheet per account).
-- Replace that key with id while retaining the account foreign key and data.
DO $$
DECLARE
    current_primary_key text;
    primary_key_columns text;
BEGIN
    SELECT conname, pg_get_constraintdef(oid)
      INTO current_primary_key, primary_key_columns
      FROM pg_constraint
     WHERE conrelid = 'sheets'::regclass AND contype = 'p';

    IF current_primary_key IS NOT NULL AND primary_key_columns <> 'PRIMARY KEY (id)' THEN
        EXECUTE format('ALTER TABLE sheets DROP CONSTRAINT %I', current_primary_key);
        current_primary_key := NULL;
    END IF;

    IF current_primary_key IS NULL THEN
        ALTER TABLE sheets ADD CONSTRAINT sheets_pkey PRIMARY KEY (id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'sheets'::regclass AND conname = 'sheets_system_check'
    ) THEN
        ALTER TABLE sheets ADD CONSTRAINT sheets_system_check CHECK (system IN ('mutantes', 'vampiro'));
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
         WHERE conrelid = 'sheets'::regclass AND conname = 'sheets_form_object_check'
    ) THEN
        ALTER TABLE sheets ADD CONSTRAINT sheets_form_object_check CHECK (jsonb_typeof(form) = 'object');
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS sheets_owner_updated_idx ON sheets (owner_uid, updated_at DESC, created_at DESC);
