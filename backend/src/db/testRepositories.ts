import { sql } from './client.ts'

import { findAllCategories } from '../repositories/categoryRepository.ts'

import {
  findPublishedEvents,
  findPublishedEventById,
} from '../repositories/eventRepository.ts'

async function main() {
  try {
    // Kategorien testen
    const categories = await findAllCategories()

    console.log('Kategorien:', categories.length)

    if (categories.length < 6) {
      throw new Error('Zu wenige Kategorien gefunden')
    }

    // Veröffentlichte Events testen
    const events = await findPublishedEvents()

    console.log('Veröffentlichte Events:', events.length)

    if (events.length < 6) {
      throw new Error('Zu wenige Events gefunden')
    }

    // Einzelnes Event abrufen
    const party = await findPublishedEventById(
      '00000000-0000-4000-8000-000000000101',
    )

    if (!party) {
      throw new Error('Semester Opening Party nicht gefunden')
    }

    console.log('Gefundenes Event:', party.title)
    console.log('Kategorie:', party.category.name)
    console.log('Veranstalter:', party.organizer.name)

    // Prüfen, ob Entwürfe verborgen bleiben
    const draft = await findPublishedEventById(
      '00000000-0000-4000-8000-000000000107',
    )

    if (draft !== null) {
      throw new Error('Unveröffentlichtes Event ist sichtbar')
    }

    console.log('Entwurf wird korrekt ausgeblendet')

    console.log('Alle Repository-Tests erfolgreich!')
  } finally {
    await sql.end()
  }
}

await main()