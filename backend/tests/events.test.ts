import assert from 'node:assert/strict'

import { app } from '../src/app.ts'
import { sql } from '../src/db/client.ts'

const PARTY_ID = '00000000-0000-4000-8000-000000000101'
const DRAFT_ID = '00000000-0000-4000-8000-000000000107'
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000999'

Deno.test('CampusEvent REST-API Integrationstests', async (t) => {
  try {

    await t.step('GET /api/health', async () => {
      const response = await app.request('/api/health')

      assert.equal(response.status, 200)

      const data = await response.json()

      assert.equal(data.status, 'ok')
    })

    await t.step('Alle veröffentlichten Events', async () => {
      const response = await app.request('/api/events')

      assert.equal(response.status, 200)

      const events = await response.json()

      assert.equal(events.length, 6)
      assert.ok(events.every(
        (event: { status: string }) => event.status === 'published'
      ))
    })

    await t.step('Kategorie-Filter', async () => {
      const response = await app.request(
        '/api/events?category=party'
      )

      assert.equal(response.status, 200)

      const events = await response.json()

      assert.equal(events.length, 1)
      assert.equal(events[0].category.slug, 'party')
    })

    await t.step('Suche ohne Groß-/Kleinschreibung', async () => {
      const response = await app.request(
        '/api/events?search=vue'
      )

      assert.equal(response.status, 200)

      const events = await response.json()

      assert.equal(events.length, 1)
      assert.equal(
        events[0].title,
        'Vue 3 & TypeScript Workshop'
      )
    })

    await t.step('Kombinierte Filter', async () => {
      const response = await app.request(
        '/api/events?category=party&search=semester'
      )

      assert.equal(response.status, 200)

      const events = await response.json()

      assert.equal(events.length, 1)
      assert.equal(events[0].id, PARTY_ID)
    })

    await t.step('Filter ohne Ergebnisse', async () => {
      const response = await app.request(
        '/api/events?category=party&search=vue'
      )

      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), [])
    })

    await t.step('Ungültiger Filter liefert 400', async () => {
      const response = await app.request(
        '/api/events?category=party!'
      )

      assert.equal(response.status, 400)

      const data = await response.json()

      assert.equal(data.error.code, 'VALIDATION_ERROR')
    })

    await t.step('Unbekannter Filter liefert 400', async () => {
      const response = await app.request(
        '/api/events?unknown=test'
      )

      assert.equal(response.status, 400)
    })

    await t.step('Einzelnes Event abrufen', async () => {
      const response = await app.request(
        `/api/events/${PARTY_ID}`
      )

      assert.equal(response.status, 200)

      const event = await response.json()

      assert.equal(event.title, 'Semester Opening Party')
    })

    await t.step('Ungültige UUID liefert 400', async () => {
      const response = await app.request(
        '/api/events/abc'
      )

      assert.equal(response.status, 400)

      const data = await response.json()

      assert.equal(data.error.code, 'VALIDATION_ERROR')
    })

    await t.step('Unbekanntes Event liefert 404', async () => {
      const response = await app.request(
        `/api/events/${UNKNOWN_ID}`
      )

      assert.equal(response.status, 404)

      const data = await response.json()

      assert.equal(data.error.code, 'EVENT_NOT_FOUND')
    })

    await t.step('Entwurf bleibt verborgen', async () => {
      const response = await app.request(
        `/api/events/${DRAFT_ID}`
      )

      assert.equal(response.status, 404)
    })

    await t.step('Kategorien abrufen', async () => {
      const response = await app.request('/api/categories')

      assert.equal(response.status, 200)

      const categories = await response.json()

      assert.equal(categories.length, 6)
    })

    await t.step('Unbekannte Route liefert 404', async () => {
      const response = await app.request('/api/unknown')

      assert.equal(response.status, 404)

      const data = await response.json()

      assert.equal(data.error.code, 'ROUTE_NOT_FOUND')
    })

  } finally {
    // PostgreSQL-Verbindungen nach den Tests schließen
    await sql.end()
  }
})