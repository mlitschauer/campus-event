BEGIN;

-- 1. Benutzer
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'student',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT users_role_check
        CHECK (role IN ('student', 'organizer'))
);

CREATE UNIQUE INDEX users_email_unique
    ON users (LOWER(email));


-- 2. Kategorien
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE
);


-- 3. Veranstaltungen
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(255) NOT NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    capacity INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',

    organizer_id UUID NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    category_id UUID NOT NULL
        REFERENCES categories(id) ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT events_capacity_check
        CHECK (capacity > 0),

    CONSTRAINT events_date_check
        CHECK (ends_at > starts_at),

    CONSTRAINT events_status_check
        CHECK (status IN ('draft', 'published', 'cancelled'))
);


-- 4. Event-Anmeldungen
CREATE TABLE registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    event_id UUID NOT NULL
        REFERENCES events(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT registrations_unique
        UNIQUE (event_id, user_id)
);


-- 5. Login-Sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Indizes für häufige Abfragen
CREATE INDEX events_status_date_idx
    ON events(status, starts_at);

CREATE INDEX events_category_idx
    ON events(category_id);

CREATE INDEX registrations_user_idx
    ON registrations(user_id);

CREATE INDEX sessions_user_idx
    ON sessions(user_id);

COMMIT;