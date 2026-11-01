BEGIN;

-- Kategorien
INSERT INTO categories (name, slug)
VALUES
    ('Party', 'party'),
    ('Workshop', 'workshop'),
    ('Sport', 'sport'),
    ('Kultur', 'kultur'),
    ('Networking', 'networking'),
    ('Freizeit', 'freizeit')
ON CONFLICT DO NOTHING;

-- Demo-Benutzer
INSERT INTO users (
    name,
    email,
    password_hash,
    role
)
VALUES
    (
        'StuV CampusEvent Demo',
        'stuv@campusevent.example',
        '!DEMO_LOGIN_DISABLED!',
        'organizer'
    ),
    (
        'Campus Organisation',
        'organisation@campusevent.example',
        '!DEMO_LOGIN_DISABLED!',
        'organizer'
    ),
    (
        'Max Mustermann',
        'max@campusevent.example',
        '!DEMO_LOGIN_DISABLED!',
        'student'
    ),
    (
        'Lisa Beispiel',
        'lisa@campusevent.example',
        '!DEMO_LOGIN_DISABLED!',
        'student'
    ),
    (
        'Alex Muster',
        'alex@campusevent.example',
        '!DEMO_LOGIN_DISABLED!',
        'student'
    )
ON CONFLICT DO NOTHING;

-- Demo-Veranstaltungen
WITH demo_events (
    event_id,
    title,
    description,
    location,
    days_ahead,
    start_time,
    duration_hours,
    capacity,
    status,
    organizer_email,
    category_slug
) AS (
    VALUES
    (
        '00000000-0000-4000-8000-000000000101',
        'Semester Opening Party',
        'Gemeinsam feiern wir den Semesterstart.',
        'Alte Mälzerei Mosbach',
        10, TIME '21:00', 4, 150,
        'published',
        'stuv@campusevent.example',
        'party'
    ),
    (
        '00000000-0000-4000-8000-000000000102',
        'Vue 3 & TypeScript Workshop',
        'Ein Workshop zur modernen Webentwicklung.',
        'DHBW Mosbach',
        7, TIME '17:00', 2, 25,
        'published',
        'organisation@campusevent.example',
        'workshop'
    ),
    (
        '00000000-0000-4000-8000-000000000103',
        'Campus Volleyball Turnier',
        'Ein gemeinsames Volleyballturnier.',
        'Sporthalle Mosbach',
        15, TIME '18:00', 3, 40,
        'published',
        'stuv@campusevent.example',
        'sport'
    ),
    (
        '00000000-0000-4000-8000-000000000104',
        'Campus Filmabend',
        'Gemeinsam einen Filmabend erleben.',
        'DHBW Mosbach',
        12, TIME '19:00', 3, 80,
        'published',
        'organisation@campusevent.example',
        'kultur'
    ),
    (
        '00000000-0000-4000-8000-000000000105',
        'Meet & Connect',
        'Neue Studierende kennenlernen und vernetzen.',
        'Campus Mosbach',
        20, TIME '18:00', 2, 60,
        'published',
        'organisation@campusevent.example',
        'networking'
    ),
    (
        '00000000-0000-4000-8000-000000000106',
        'Campus Gaming Night',
        'Ein Abend mit verschiedenen Videospielen.',
        'DHBW Mosbach',
        9, TIME '20:00', 4, 35,
        'published',
        'stuv@campusevent.example',
        'freizeit'
    ),
    (
        '00000000-0000-4000-8000-000000000107',
        'Campus Festival',
        'Ein neues Campus-Festival ist in Planung.',
        'Campus Mosbach',
        30, TIME '16:00', 6, 250,
        'draft',
        'stuv@campusevent.example',
        'party'
    )
)

INSERT INTO events (
    id,
    title,
    description,
    location,
    starts_at,
    ends_at,
    capacity,
    status,
    organizer_id,
    category_id
)
SELECT
    e.event_id::UUID,
    e.title,
    e.description,
    e.location,

    (
        (CURRENT_DATE + e.days_ahead) + e.start_time
    ) AT TIME ZONE 'Europe/Berlin',

    (
        (
            (CURRENT_DATE + e.days_ahead) + e.start_time
        ) AT TIME ZONE 'Europe/Berlin'
    ) + e.duration_hours * INTERVAL '1 hour',

    e.capacity,
    e.status,
    u.id,
    c.id

FROM demo_events e

JOIN users u
    ON LOWER(u.email) = e.organizer_email

JOIN categories c
    ON c.slug = e.category_slug

ON CONFLICT (id) DO NOTHING;

COMMIT;