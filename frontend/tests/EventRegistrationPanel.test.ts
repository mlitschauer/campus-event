
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  flushPromises,
  mount,
} from '@vue/test-utils'

import { nextTick, ref } from 'vue'

import EventRegistrationPanel from
  '../src/components/events/EventRegistrationPanel.vue'

import { useAuth } from '../src/composables/useAuth'

import {
  getEventAvailability,
  getRegistrationStatus,
  registerForEvent,
  unregisterFromEvent,
} from '../src/services/registrationService'

import type {
  EventAvailability,
  StudentRegistrationStatus,
} from '../src/types/registration'

// Auth-Composable simulieren
vi.mock('../src/composables/useAuth', () => ({
  useAuth: vi.fn(),
}))

// Router simulieren
vi.mock('vue-router', () => ({
  useRoute: () => ({
    fullPath: '/events/test-event',
  }),
}))

// REST-Aufrufe simulieren
vi.mock('../src/services/registrationService', () => ({
  getEventAvailability: vi.fn(),
  getRegistrationStatus: vi.fn(),
  registerForEvent: vi.fn(),
  unregisterFromEvent: vi.fn(),
}))

const eventId = 'event-test-1'

const availability: EventAvailability = {
  eventId,
  capacity: 5,
  registeredCount: 2,
  availableSeats: 3,
  isRegistrationOpen: true,
}

// Standardzustand eines noch nicht angemeldeten Studenten
function studentStatus(
  changes: Partial<StudentRegistrationStatus> = {},
): StudentRegistrationStatus {
  return {
    ...availability,
    isRegistered: false,
    canRegister: true,
    canUnregister: false,
    ...changes,
  }
}

// Verschiedene Rollen für die Tests bereitstellen
function mockAuth(
  role: 'student' | 'organizer' | null,
) {
  const user = ref(
    role
      ? {
          id: 'test-user-1',
          role,
        }
      : null,
  )

  vi.mocked(useAuth).mockReturnValue({
    user,
    status: ref('ready'),
    initializeAuth: vi.fn(async () => {}),
  } as unknown as ReturnType<typeof useAuth>)

  return user
}

function renderPanel() {
  return mount(EventRegistrationPanel, {
    props: { eventId },

    global: {
      stubs: {
        RouterLink: {
          props: ['to'],
          template: '<a><slot /></a>',
        },
      },
    },
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('CE-27: EventRegistrationPanel', () => {
  it('zeigt nach Logout keine veraltete Anmeldebestätigung', async () => {
    const user = mockAuth('student')

    vi.mocked(getRegistrationStatus)
      .mockResolvedValue(studentStatus())

    vi.mocked(getEventAvailability)
      .mockResolvedValue(availability)

    type RegistrationResult =
      Awaited<ReturnType<typeof registerForEvent>>

    let finishRequest!: (value: RegistrationResult) => void

    const pendingRequest = new Promise<RegistrationResult>(
      (resolve) => {
        finishRequest = resolve
      },
    )

    vi.mocked(registerForEvent)
      .mockReturnValue(pendingRequest)

    const wrapper = renderPanel()
    await flushPromises()

    // Anmeldung auslösen, HTTP-Antwort bleibt zunächst offen.
    await wrapper.get('button').trigger('click')

    // Währenddessen erfolgt ein Logout.
    user.value = null
    await flushPromises()

    // Erst jetzt kommt die erfolgreiche Antwort zurück.
    finishRequest({
      id: 'registration-late',
      eventId,
      userId: 'test-user-1',
      createdAt: new Date().toISOString(),
    })

    await flushPromises()

    // Der frühere Benutzerstatus darf nicht angezeigt werden.
    expect(wrapper.text()).not.toContain(
      'Du bist erfolgreich für diese Veranstaltung angemeldet.',
    )

    expect(wrapper.text()).not.toContain(
      'Du bist für diese Veranstaltung angemeldet.',
    )

    wrapper.unmount()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe.each(['register', 'unregister'] as const)('%s', (action) => {
    it.each(
      ['logout', 'user', 'role', 'event', 'unmount'].flatMap((change) =>
        ['success', 'error'].map((outcome) => ({ change, outcome })),
      ),
    )('ignoriert $outcome nach $change', async ({ change, outcome }) => {
      const user = mockAuth('student')
      vi.mocked(getRegistrationStatus).mockResolvedValue(studentStatus({
        isRegistered: action === 'unregister',
        canRegister: action === 'register',
        canUnregister: action === 'unregister',
      }))
      vi.mocked(getEventAvailability).mockResolvedValue(availability)
      vi.spyOn(window, 'confirm').mockReturnValue(true)

      const pending = deferred<Awaited<ReturnType<typeof registerForEvent>>>()
      if (action === 'register') {
        vi.mocked(registerForEvent).mockReturnValue(pending.promise)
      } else {
        vi.mocked(unregisterFromEvent).mockImplementation(async () => {
          await pending.promise
        })
      }

      const wrapper = renderPanel()
      await flushPromises()
      await wrapper.get('button').trigger('click')
      expect(action === 'register' ? registerForEvent : unregisterFromEvent)
        .toHaveBeenCalledWith(eventId)

      if (change === 'logout') user.value = null
      if (change === 'user') user.value = { id: 'test-user-2', role: 'student' }
      if (change === 'role') user.value = { id: 'test-user-1', role: 'organizer' }
      if (change === 'event') await wrapper.setProps({ eventId: 'event-test-2' })
      if (change === 'unmount') wrapper.unmount()
      await flushPromises()

      const statusCalls = vi.mocked(getRegistrationStatus).mock.calls.length
      const availabilityCalls = vi.mocked(getEventAvailability).mock.calls.length
      if (outcome === 'error') {
        pending.reject(new Error('Verspäteter Fehler'))
      } else {
        pending.resolve({
          id: 'registration-1', eventId, userId: 'test-user-1',
          createdAt: '2026-11-17T12:00:00.000Z',
        })
      }
      await flushPromises()

      expect(getRegistrationStatus).toHaveBeenCalledTimes(statusCalls)
      expect(getEventAvailability).toHaveBeenCalledTimes(availabilityCalls)
      if (change !== 'unmount') {
        expect(wrapper.find('.registration-notice--success').exists()).toBe(false)
        expect(wrapper.find('[role="alert"]').exists()).toBe(false)
        if (change === 'logout') expect(wrapper.text()).toContain('Zum Login')
        wrapper.unmount()
      }
    })
  })

  it('schützt eine neue Aktion vor dem Abschluss der alten Aktion', async () => {
    const user = mockAuth('student')
    vi.mocked(getRegistrationStatus).mockResolvedValue(studentStatus())
    const oldAction = deferred<Awaited<ReturnType<typeof registerForEvent>>>()
    const newAction = deferred<Awaited<ReturnType<typeof registerForEvent>>>()
    vi.mocked(registerForEvent)
      .mockReturnValueOnce(oldAction.promise)
      .mockReturnValueOnce(newAction.promise)

    const wrapper = renderPanel()
    await flushPromises()
    const button = wrapper.get('button')
    // Zwei Klicks noch vor dem nächsten Render dürfen nur eine Anfrage auslösen.
    button.element.dispatchEvent(new MouseEvent('click'))
    button.element.dispatchEvent(new MouseEvent('click'))
    await nextTick()
    expect(registerForEvent).toHaveBeenCalledTimes(1)

    user.value = { id: 'test-user-2', role: 'student' }
    await flushPromises()
    expect(wrapper.get('button').element.disabled).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(registerForEvent).toHaveBeenCalledTimes(2)

    oldAction.reject(new Error('Alter Fehler'))
    await flushPromises()
    expect(wrapper.get('button').element.disabled).toBe(true)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(getRegistrationStatus).toHaveBeenCalledTimes(2)

    newAction.resolve({
      id: 'registration-2', eventId, userId: 'test-user-2',
      createdAt: '2026-11-17T12:00:00.000Z',
    })
    await flushPromises()
    expect(wrapper.get('button').element.disabled).toBe(false)
    expect(wrapper.find('.registration-notice--success').exists()).toBe(true)
    expect(getRegistrationStatus).toHaveBeenCalledTimes(3)
    wrapper.unmount()
  })

  it('zeigt Gästen nur die öffentliche Belegung', async () => {
    mockAuth(null)

    vi.mocked(getEventAvailability)
      .mockResolvedValue(availability)

    const wrapper = renderPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('2')
    expect(wrapper.text()).toContain('5')
    expect(wrapper.text()).toContain('3 Plätze frei')

    expect(wrapper.text()).toContain('Zum Login')
    expect(wrapper.text()).not.toContain('Jetzt anmelden')

    expect(getRegistrationStatus)
      .not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('zeigt Organizers keinen Anmeldebutton', async () => {
    mockAuth('organizer')

    vi.mocked(getEventAvailability)
      .mockResolvedValue(availability)

    const wrapper = renderPanel()
    await flushPromises()

    expect(wrapper.text()).toContain(
      'ausschließlich Studentenaccounts',
    )

    expect(wrapper.text()).not.toContain('Jetzt anmelden')

    expect(getRegistrationStatus)
      .not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('zeigt Studenten den Anmeldebutton', async () => {
    mockAuth('student')

    vi.mocked(getRegistrationStatus)
      .mockResolvedValue(studentStatus())

    const wrapper = renderPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Jetzt anmelden')
    expect(wrapper.text()).not.toContain(
      'Anmeldung zurückziehen',
    )

    expect(getRegistrationStatus)
      .toHaveBeenCalledWith(eventId)

    wrapper.unmount()
  })

  it('meldet einen Studenten erfolgreich an', async () => {
    mockAuth('student')

    vi.mocked(getRegistrationStatus)
      .mockResolvedValueOnce(studentStatus())
      .mockResolvedValueOnce(
        studentStatus({
          registeredCount: 3,
          availableSeats: 2,
          isRegistered: true,
          canRegister: false,
          canUnregister: true,
        }),
      )

    vi.mocked(registerForEvent).mockResolvedValue({
      id: 'registration-1',
      eventId,
      userId: 'test-user-1',
      createdAt: '2026-11-17T12:00:00.000Z',
    })

    const wrapper = renderPanel()
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(registerForEvent)
      .toHaveBeenCalledWith(eventId)

    expect(wrapper.text()).toContain(
      'Du bist für diese Veranstaltung angemeldet.',
    )

    expect(wrapper.text()).toContain(
      'Anmeldung zurückziehen',
    )

    wrapper.unmount()
  })

  it('verhindert die Abmeldung ohne Bestätigung', async () => {
    mockAuth('student')

    vi.mocked(getRegistrationStatus)
      .mockResolvedValue(
        studentStatus({
          isRegistered: true,
          canRegister: false,
          canUnregister: true,
        }),
      )

    const confirmMock = vi
      .spyOn(window, 'confirm')
      .mockReturnValue(false)

    const wrapper = renderPanel()
    await flushPromises()

    await wrapper.get('button').trigger('click')

    expect(confirmMock).toHaveBeenCalled()
    expect(unregisterFromEvent).not.toHaveBeenCalled()

    confirmMock.mockRestore()
    wrapper.unmount()
  })

  it('meldet einen Studenten nach Bestätigung ab', async () => {
    mockAuth('student')

    vi.mocked(getRegistrationStatus)
      .mockResolvedValueOnce(
        studentStatus({
          isRegistered: true,
          canRegister: false,
          canUnregister: true,
        }),
      )
      .mockResolvedValueOnce(studentStatus())

    vi.mocked(unregisterFromEvent)
      .mockResolvedValue()

    const confirmMock = vi
      .spyOn(window, 'confirm')
      .mockReturnValue(true)

    const wrapper = renderPanel()
    await flushPromises()

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(unregisterFromEvent)
      .toHaveBeenCalledWith(eventId)

    expect(wrapper.text()).toContain('Jetzt anmelden')

    confirmMock.mockRestore()
    wrapper.unmount()
  })

  it('zeigt bei ausgebuchten Events keinen Anmeldebutton', async () => {
    mockAuth('student')

    vi.mocked(getRegistrationStatus)
      .mockResolvedValue(
        studentStatus({
          registeredCount: 5,
          availableSeats: 0,
          isRegistrationOpen: false,
          canRegister: false,
        }),
      )

    const wrapper = renderPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Ausgebucht')
    expect(wrapper.text()).not.toContain('Jetzt anmelden')

    wrapper.unmount()
  })

  it('zeigt eine Fehlermeldung bei API-Problemen', async () => {
    mockAuth('student')

    vi.mocked(getRegistrationStatus)
      .mockRejectedValue(new Error('Netzwerkfehler'))

    const wrapper = renderPanel()
    await flushPromises()

    expect(wrapper.text()).toContain(
      'Die Teilnahmeinformationen konnten nicht geladen werden.',
    )

    expect(wrapper.text()).toContain('Erneut versuchen')

    wrapper.unmount()
  })

  it('verwirft eine veraltete Event-Antwort', async () => {
    mockAuth('student')

    let resolveOldRequest!: (
      value: StudentRegistrationStatus
    ) => void

    const oldRequest = new Promise<StudentRegistrationStatus>(
      (resolve) => {
        resolveOldRequest = resolve
      },
    )

    vi.mocked(getRegistrationStatus)
      .mockImplementation((id) => {
        if (id === eventId) {
          return oldRequest
        }

        return Promise.resolve(
          studentStatus({
            eventId: 'event-test-2',
            isRegistered: true,
            canRegister: false,
            canUnregister: true,
          }),
        )
      })

    const wrapper = renderPanel()

    // Während der ersten Anfrage auf ein anderes Event wechseln
    await wrapper.setProps({
      eventId: 'event-test-2',
    })

    await flushPromises()

    // Die alte Anfrage trifft erst danach ein
    resolveOldRequest(studentStatus())
    await flushPromises()

    // Alte Daten dürfen den neuen Status nicht überschreiben
    expect(wrapper.text()).toContain(
      'Du bist für diese Veranstaltung angemeldet.',
    )

    expect(wrapper.text()).not.toContain('Jetzt anmelden')

    wrapper.unmount()
  })
})
