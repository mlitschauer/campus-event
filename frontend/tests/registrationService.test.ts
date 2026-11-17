
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  getJson,
  postJson,
  deleteNoContent,
} from '../src/services/api'

import {
  getEventAvailability,
  getRegistrationStatus,
  getMyRegistrations,
  registerForEvent,
  unregisterFromEvent,
} from '../src/services/registrationService'

// Zentrale Fetch-Funktionen simulieren
vi.mock('../src/services/api', () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
  deleteNoContent: vi.fn(),
}))

const eventId = '550e8400-e29b-41d4-a716-446655440000'

describe('CE-27: RegistrationService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('lädt öffentliche Belegungsinformationen', async () => {
    const availability = {
      eventId,
      capacity: 50,
      registeredCount: 10,
      availableSeats: 40,
      isRegistrationOpen: true,
    }

    vi.mocked(getJson).mockResolvedValue({
      availability,
    })

    const result = await getEventAvailability(eventId)

    expect(result).toEqual(availability)

    expect(getJson).toHaveBeenCalledWith(
      `/api/events/${eventId}/availability`,
    )
  })

  it('lädt den persönlichen Anmeldestatus', async () => {
    const registrationStatus = {
      eventId,
      capacity: 50,
      registeredCount: 10,
      availableSeats: 40,
      isRegistrationOpen: true,
      isRegistered: false,
      canRegister: true,
      canUnregister: false,
    }

    vi.mocked(getJson).mockResolvedValue({
      registrationStatus,
    })

    const result = await getRegistrationStatus(eventId)

    expect(result).toEqual(registrationStatus)

    expect(getJson).toHaveBeenCalledWith(
      `/api/events/${eventId}/registration-status`,
    )
  })

  it('lädt ausschließlich die eigene Anmeldeliste', async () => {
    vi.mocked(getJson).mockResolvedValue({
      registrations: [],
    })

    const result = await getMyRegistrations()

    expect(result).toEqual([])

    expect(getJson).toHaveBeenCalledWith(
      '/api/me/registrations',
    )
  })

  it('meldet den Studenten über POST an', async () => {
    const registration = {
      id: 'registration-1',
      eventId,
      userId: 'student-1',
      createdAt: '2026-11-17T12:00:00.000Z',
    }

    vi.mocked(postJson).mockResolvedValue({
      registration,
    })

    const result = await registerForEvent(eventId)

    expect(result).toEqual(registration)

    expect(postJson).toHaveBeenCalledWith(
      `/api/events/${eventId}/registrations`,
    )
  })

  it('meldet über DELETE ab', async () => {
    vi.mocked(deleteNoContent).mockResolvedValue()

    await unregisterFromEvent(eventId)

    expect(deleteNoContent).toHaveBeenCalledWith(
      `/api/events/${eventId}/registrations/me`,
    )
  })

  it('kodiert Event-IDs für URL-Pfade', async () => {
    const unusualId = 'test/id mit Leerzeichen'

    vi.mocked(getJson).mockResolvedValue({
      availability: {
        eventId: unusualId,
        capacity: 10,
        registeredCount: 0,
        availableSeats: 10,
        isRegistrationOpen: true,
      },
    })

    await getEventAvailability(unusualId)

    expect(getJson).toHaveBeenCalledWith(
      `/api/events/${encodeURIComponent(unusualId)}/availability`,
    )
  })

  it('übergibt keine frei wählbare User-ID', async () => {
    vi.mocked(getJson).mockResolvedValue({
      registrations: [],
    })

    await getMyRegistrations()

    expect(getJson).toHaveBeenCalledTimes(1)
    expect(getJson).toHaveBeenCalledWith(
      '/api/me/registrations',
    )
  })
})
