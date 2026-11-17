
import assert from 'node:assert/strict'

import { app } from '../src/app.ts'
import { sql } from '../src/db/client.ts'

import {
  createSession,
  revokeSession,
} from '../src/services/sessionService.ts'

const ORIGIN = 'http://localhost:5173'

type TestRole = 'student' | 'organizer'

Deno.test(
  'CE-25: Eigene Anmeldungen und freie Plätze',
  async (t) => {
    const userIds: string[] = []
    const eventIds: string[] = []
    const tokens: string[] = []

    // Temporären Testbenutzer erstellen
    const createTestUser = async (
      role: TestRole,
    ): Promise<string> => {
      const email =
        `ce25-${role}-${crypto.randomUUID()}@campusevent.example`

      const rows = await sql<{ id: string }[]>`
        INSERT INTO users (
          name,
          email,
          password_hash,
          role
        )
        VALUES (
          'CE25 Integrationstest',
          ${email},
          '!CE25_LOGIN_DISABLED!',
          ${role}
        )
        RETURNING id
      `

      assert.ok(rows[0])
      userIds.push(rows[0].id)

      return rows[0].id
    }

    // API-Anfragen mit optionaler Session
    const request = (
      method: 'GET' | 'POST' | 'DELETE',
      path: string,
      token?: string,
    ) => {
      const headers: Record<string, string> = {
        Origin: ORIGIN,
      }

      if (token) {
        headers.Cookie =
          `campus_event_session=${token}`
      }

      return app.request(path, {
        method,
        headers,
      })
    }

    try {
      // Eine bestehende Kategorie verwenden
      const categories = await sql<{ id: string }[]>`
        SELECT id
        FROM categories
        LIMIT 1
      `

      assert.ok(
        categories[0],
        'Keine Kategorien vorhanden. Demo-Seed überprüfen.',
      )

      // Temporäre Benutzer und Sessions
      const organizer = await createTestUser('organizer')
      const studentA = await createTestUser('student')
      const studentB = await createTestUser('student')

      const organizerSession = await createSession(organizer)
      const sessionA = await createSession(studentA)
      const sessionB = await createSession(studentB)

      tokens.push(
        organizerSession.token,
        sessionA.token,
        sessionB.token,
      )

      // Veranstaltung in der Zukunft erstellen
      const startsAt = new Date(
        Date.now() + 14 * 24 * 60 * 60 * 1000,
      )

      const endsAt = new Date(
        startsAt.getTime() + 2 * 60 * 60 * 1000,
      )

      const createResponse = await app.request(
        '/api/events',
        {
          method: 'POST',
          headers: {
            Origin: ORIGIN,
            Cookie:
              `campus_event_session=${organizerSession.token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: 'CE25 Testveranstaltung',
            description:
              'Automatisch erstelltes Event zum Testen der Anmeldeübersicht.',
            location: 'DHBW Mosbach',
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            capacity: 2,
            categoryId: categories[0].id,
          }),
        },
      )

      assert.equal(createResponse.status, 201)

      const created = await createResponse.json()
      const eventId: string = created.event.id

      eventIds.push(eventId)

      const availabilityPath =
        `/api/events/${eventId}/availability`

      const statusPath =
        `/api/events/${eventId}/registration-status`

      const registerPath =
        `/api/events/${eventId}/registrations`

      const unregisterPath =
        `/api/events/${eventId}/registrations/me`

      const ownListPath = '/api/me/registrations'

      // TEST 1
      await t.step(
        'Gast darf eigene Anmeldungen nicht abrufen',
        async () => {
          const response = await request(
            'GET',
            ownListPath,
          )

          assert.equal(response.status, 401)
        },
      )

      // TEST 2
      await t.step(
        'Organizer darf Studenten-Anmeldeliste nicht abrufen',
        async () => {
          const response = await request(
            'GET',
            ownListPath,
            organizerSession.token,
          )

          assert.equal(response.status, 403)
        },
      )

      // TEST 3
      await t.step(
        'Neuer Student erhält eine leere Anmeldeliste',
        async () => {
          const response = await request(
            'GET',
            ownListPath,
            sessionA.token,
          )

          assert.equal(response.status, 200)

          const data = await response.json()

          assert.deepEqual(data.registrations, [])

          assert.equal(
            response.headers.get('cache-control'),
            'no-store',
          )
        },
      )

      // TEST 4
      await t.step(
        'Entwurf besitzt keine öffentliche Belegungsansicht',
        async () => {
          const response = await request(
            'GET',
            availabilityPath,
          )

          assert.equal(response.status, 404)
        },
      )

      // TEST 5
      await t.step(
        'Entwurf besitzt keinen Studenten-Anmeldestatus',
        async () => {
          const response = await request(
            'GET',
            statusPath,
            sessionA.token,
          )

          assert.equal(response.status, 404)
        },
      )

      // TEST 6
      await t.step(
        'Ungültige UUID bei Availability liefert 400',
        async () => {
          const response = await request(
            'GET',
            '/api/events/ungueltig/availability',
          )

          assert.equal(response.status, 400)
        },
      )

      // TEST 7
      await t.step(
        'Ungültige UUID beim Anmeldestatus liefert 400',
        async () => {
          const response = await request(
            'GET',
            '/api/events/ungueltig/registration-status',
            sessionA.token,
          )

          assert.equal(response.status, 400)
        },
      )

      // Veranstaltung veröffentlichen
      const publishResponse = await request(
        'POST',
        `/api/events/${eventId}/publish`,
        organizerSession.token,
      )

      assert.equal(publishResponse.status, 200)

      // TEST 8
      await t.step(
        'Öffentliche Belegung zeigt zwei freie Plätze',
        async () => {
          const response = await request(
            'GET',
            availabilityPath,
          )

          assert.equal(response.status, 200)

          const data = await response.json()
          const availability = data.availability

          assert.equal(availability.eventId, eventId)
          assert.equal(availability.capacity, 2)
          assert.equal(availability.registeredCount, 0)
          assert.equal(availability.availableSeats, 2)
          assert.equal(availability.isRegistrationOpen, true)

          // Keine privaten Informationen veröffentlichen
          assert.equal(availability.isRegistered, undefined)
          assert.equal(availability.userId, undefined)

          assert.equal(
            response.headers.get('cache-control'),
            'no-store',
          )
        },
      )

      // TEST 9
      await t.step(
        'Gast erhält keinen persönlichen Anmeldestatus',
        async () => {
          const response = await request(
            'GET',
            statusPath,
          )

          assert.equal(response.status, 401)
        },
      )

      // TEST 10
      await t.step(
        'Organizer erhält keinen Studenten-Anmeldestatus',
        async () => {
          const response = await request(
            'GET',
            statusPath,
            organizerSession.token,
          )

          assert.equal(response.status, 403)
        },
      )

      // TEST 11
      await t.step(
        'Student A kann sich zunächst anmelden',
        async () => {
          const response = await request(
            'GET',
            statusPath,
            sessionA.token,
          )

          assert.equal(response.status, 200)

          const data = await response.json()
          const status = data.registrationStatus

          assert.equal(status.isRegistered, false)
          assert.equal(status.canRegister, true)
          assert.equal(status.canUnregister, false)
          assert.equal(status.availableSeats, 2)
        },
      )

      // Student A tatsächlich anmelden
      const firstRegistration = await request(
        'POST',
        registerPath,
        sessionA.token,
      )

      assert.equal(firstRegistration.status, 201)

      // TEST 12
      await t.step(
        'Öffentliche Belegung aktualisiert sich auf einen Platz',
        async () => {
          const response = await request(
            'GET',
            availabilityPath,
          )

          assert.equal(response.status, 200)

          const data = await response.json()

          assert.equal(data.availability.registeredCount, 1)
          assert.equal(data.availability.availableSeats, 1)
          assert.equal(data.availability.isRegistrationOpen, true)
        },
      )

      // TEST 13
      await t.step(
        'Student A sieht seine bestehende Anmeldung',
        async () => {
          const response = await request(
            'GET',
            statusPath,
            sessionA.token,
          )

          assert.equal(response.status, 200)

          const data = await response.json()
          const status = data.registrationStatus

          assert.equal(status.isRegistered, true)
          assert.equal(status.canRegister, false)
          assert.equal(status.canUnregister, true)
        },
      )

      // TEST 14
      await t.step(
        'Student B erhält seinen eigenen Status',
        async () => {
          const response = await request(
            'GET',
            statusPath,
            sessionB.token,
          )

          assert.equal(response.status, 200)

          const data = await response.json()
          const status = data.registrationStatus

          assert.equal(status.isRegistered, false)
          assert.equal(status.canRegister, true)
          assert.equal(status.availableSeats, 1)
        },
      )

      // TEST 15
      await t.step(
        'Student A sieht seinen Event in Meine Anmeldungen',
        async () => {
          const response = await request(
            'GET',
            ownListPath,
            sessionA.token,
          )

          assert.equal(response.status, 200)

          const data = await response.json()

          assert.equal(data.registrations.length, 1)

          const registration = data.registrations[0]

          assert.equal(registration.event.id, eventId)
          assert.equal(registration.event.status, 'published')
          assert.equal(registration.event.organizer.id, organizer)
          assert.equal(typeof registration.id, 'string')
          assert.equal(typeof registration.registeredAt, 'string')
          assert.equal(registration.event.capacity, 2)
        },
      )

      // TEST 16
      await t.step(
        'Student B sieht keine Anmeldungen von Student A',
        async () => {
          const response = await request(
            'GET',
            ownListPath,
            sessionB.token,
          )

          assert.equal(response.status, 200)

          const data = await response.json()

          assert.deepEqual(data.registrations, [])
        },
      )

      // Student B belegt den letzten Platz
      const secondRegistration = await request(
        'POST',
        registerPath,
        sessionB.token,
      )

      assert.equal(secondRegistration.status, 201)

      // TEST 17
      await t.step(
        'Ausgebuchtes Event zeigt keine freien Plätze',
        async () => {
          const publicResponse = await request(
            'GET',
            availabilityPath,
          )

          const publicData = await publicResponse.json()

          assert.equal(publicData.availability.registeredCount, 2)
          assert.equal(publicData.availability.availableSeats, 0)
          assert.equal(publicData.availability.isRegistrationOpen, false)

          const statusResponse = await request(
            'GET',
            statusPath,
            sessionB.token,
          )

          const statusData = await statusResponse.json()
          const status = statusData.registrationStatus

          assert.equal(status.isRegistered, true)
          assert.equal(status.canRegister, false)

          // Trotz ausgebuchtem Event abmelden können
          assert.equal(status.canUnregister, true)
        },
      )

      // TEST 18
      await t.step(
        'Abmeldung gibt einen Platz wieder frei',
        async () => {
          const deleteResponse = await request(
            'DELETE',
            unregisterPath,
            sessionA.token,
          )

          assert.equal(deleteResponse.status, 204)

          const ownResponse = await request(
            'GET',
            ownListPath,
            sessionA.token,
          )

          const ownData = await ownResponse.json()

          assert.deepEqual(ownData.registrations, [])

          const availabilityResponse = await request(
            'GET',
            availabilityPath,
          )

          const availabilityData =
            await availabilityResponse.json()

          assert.equal(
            availabilityData.availability.availableSeats,
            1,
          )
        },
      )

      // TEST 19
      await t.step(
        'Query-Parameter kann Benutzeridentität nicht ändern',
        async () => {
          const response = await request(
            'GET',
            `/api/me/registrations?userId=${studentB}`,
            sessionA.token,
          )

          assert.equal(response.status, 200)

          const data = await response.json()

          // Student A darf Student Bs Anmeldung nicht sehen.
          assert.deepEqual(data.registrations, [])
        },
      )

      // TEST 20
      await t.step(
        'Abgesagtes Event bleibt in eigener Anmeldeliste',
        async () => {
          const cancelled = await request(
            'POST',
            `/api/events/${eventId}/cancel`,
            organizerSession.token,
          )

          assert.equal(cancelled.status, 200)

          // Öffentliche Belegung nicht mehr abrufbar
          const publicResponse = await request(
            'GET',
            availabilityPath,
          )

          assert.equal(publicResponse.status, 404)

          // Persönlicher Status nicht mehr über öffentliche
          // Eventdetail-Route abrufbar
          const statusResponse = await request(
            'GET',
            statusPath,
            sessionB.token,
          )

          assert.equal(statusResponse.status, 404)

          // Bestehende Anmeldung bleibt erhalten
          const ownResponse = await request(
            'GET',
            ownListPath,
            sessionB.token,
          )

          assert.equal(ownResponse.status, 200)

          const data = await ownResponse.json()

          assert.equal(data.registrations.length, 1)
          assert.equal(data.registrations[0].event.id, eventId)
          assert.equal(
            data.registrations[0].event.status,
            'cancelled',
          )
        },
      )

      // TEST 21
      await t.step(
        'Private GET-Anfrage funktioniert ohne Origin-Header',
        async () => {
          const response = await app.request(
            ownListPath,
            {
              headers: {
                Cookie:
                  `campus_event_session=${sessionB.token}`,
              },
            },
          )

          assert.equal(response.status, 200)
        },
      )

    } finally {
      // Nur temporäre CE-25-Daten entfernen
      try {
        for (const eventId of eventIds) {
          await sql`
            DELETE FROM registrations
            WHERE event_id = ${eventId}::uuid
          `

          await sql`
            DELETE FROM events
            WHERE id = ${eventId}::uuid
          `
        }

        for (const token of tokens) {
          await revokeSession(token)
        }

        for (const userId of userIds) {
          await sql`
            DELETE FROM users
            WHERE id = ${userId}::uuid
          `
        }
      } finally {
        await sql.end()
      }
    }
  },
)
