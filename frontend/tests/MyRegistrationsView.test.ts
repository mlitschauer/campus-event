
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

import MyRegistrationsView from
    '../src/views/MyRegistrationsView.vue'

import { useAuth } from '../src/composables/useAuth'

import {
    getMyRegistrations,
    unregisterFromEvent,
} from '../src/services/registrationService'

import type {
    MyRegistration,
} from '../src/types/registration'

// Authentifizierung simulieren
vi.mock('../src/composables/useAuth', () => ({
    useAuth: vi.fn(),
}))

// Navigation simulieren
vi.mock('vue-router', () => ({
    useRouter: () => ({
        replace: vi.fn(),
    }),
}))

// API simulieren
vi.mock('../src/services/registrationService', () => ({
    getMyRegistrations: vi.fn(),
    unregisterFromEvent: vi.fn(),
}))

// Eventbeginn garantiert in der Zukunft
const futureDate = new Date(
    Date.now() + 14 * 24 * 60 * 60 * 1000,
).toISOString()

const futureEnd = new Date(
    Date.now() + 15 * 24 * 60 * 60 * 1000,
).toISOString()

function testRegistration(
    title: string,
    status: 'published' | 'cancelled' = 'published',
): MyRegistration {
    return {
        id: `registration-${title}`,
        registeredAt: '2026-11-17T12:00:00.000Z',

        event: {
            id: `event-${title}`,
            title,
            description: 'Testveranstaltung für CE-27.',
            location: 'DHBW Mosbach',
            startsAt: futureDate,
            endsAt: futureEnd,
            capacity: 30,
            status,

            organizer: {
                id: 'organizer-1',
                name: 'CE27 Test Organizer',
            },

            category: {
                id: 'category-1',
                name: 'Freizeit',
                slug: 'freizeit',
            },
        },
    }
}

function mockStudentAuth() {
    const user = ref<{
        id: string
        role: string
    } | null>({
        id: 'student-1',
        role: 'student',
    })

    vi.mocked(useAuth).mockReturnValue({
        user,
    } as unknown as ReturnType<typeof useAuth>)

    return user
}

function renderView() {
    return mount(MyRegistrationsView, {
        props: {},

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

describe('CE-27: MyRegistrationsView', () => {
    it('verwirft eine verspätete Abmeldeantwort nach Logout', async () => {
        const user = mockStudentAuth()

        vi.mocked(getMyRegistrations)
            .mockResolvedValue([
                testRegistration('CE27 Logout Test'),
            ])

        let finishRequest!: () => void

        const pendingRequest = new Promise<void>(
            (resolve) => {
                finishRequest = resolve
            },
        )

        vi.mocked(unregisterFromEvent)
            .mockReturnValue(pendingRequest)

        const confirmMock = vi
            .spyOn(window, 'confirm')
            .mockReturnValue(true)

        const wrapper = renderView()
        await flushPromises()

        const removeButton = wrapper
            .findAll('button')
            .find((button) =>
                button.text().includes('Anmeldung zurückziehen')
            )

        expect(removeButton).toBeDefined()

        await removeButton!.trigger('click')

        // Logout während der laufenden Abmeldung
        user.value = null
        await nextTick()

        // Abmeldeantwort trifft erst danach ein
        finishRequest()
        await flushPromises()

        expect(wrapper.text()).not.toContain(
            'CE27 Logout Test',
        )

        expect(wrapper.text()).not.toContain(
            'wurde zurückgezogen.',
        )

        confirmMock.mockRestore()
        wrapper.unmount()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    beforeEach(() => {
        vi.resetAllMocks()
    })

    it.each(
        ['logout', 'user', 'role', 'unmount'].flatMap((change) =>
            ['success', 'error'].map((outcome) => ({ change, outcome })),
        ),
    )('ignoriert verspätetes $outcome nach $change', async ({ change, outcome }) => {
        const user = mockStudentAuth()
        const registration = testRegistration('Privater Workshop')
        vi.mocked(getMyRegistrations).mockResolvedValue([registration])
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        const pending = deferred<void>()
        vi.mocked(unregisterFromEvent).mockReturnValue(pending.promise)

        const wrapper = renderView()
        await flushPromises()
        await wrapper.get('.my-reg-danger-button').trigger('click')
        expect(unregisterFromEvent).toHaveBeenCalledWith(registration.event.id)

        if (change === 'logout') user.value = null
        if (change === 'user') user.value = { id: 'student-2', role: 'student' }
        if (change === 'role') user.value = { id: 'student-1', role: 'organizer' }
        if (change === 'unmount') wrapper.unmount()
        await flushPromises()
        const loadCalls = vi.mocked(getMyRegistrations).mock.calls.length

        if (outcome === 'success') pending.resolve()
        else pending.reject(new Error('Verspäteter Fehler'))
        await flushPromises()

        expect(getMyRegistrations).toHaveBeenCalledTimes(loadCalls)
        if (change !== 'unmount') {
            expect(wrapper.find('.my-reg-message').exists()).toBe(false)
            if (change === 'logout' || change === 'role') {
                expect(wrapper.find('.my-reg-card').exists()).toBe(false)
            } else {
                // Auch dieselbe Anmeldung des neuen Benutzers muss erhalten bleiben.
                expect(wrapper.get('.my-reg-card').text()).toContain(registration.event.title)
            }
            wrapper.unmount()
        }
    })

    it.each(['success', 'error'])('lässt eine neue Abmeldung bei altem %s gesperrt', async (outcome) => {
        const user = mockStudentAuth()
        vi.mocked(getMyRegistrations).mockResolvedValue([
            testRegistration('Workshop'),
            testRegistration('Sommerfest'),
        ])
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        const oldAction = deferred<void>()
        const newAction = deferred<void>()
        vi.mocked(unregisterFromEvent)
            .mockReturnValueOnce(oldAction.promise)
            .mockReturnValueOnce(newAction.promise)
        const wrapper = renderView()
        await flushPromises()

        const buttons = wrapper.findAll('.my-reg-danger-button')
        buttons[0]!.element.dispatchEvent(new MouseEvent('click'))
        buttons[1]!.element.dispatchEvent(new MouseEvent('click'))
        await nextTick()
        expect(unregisterFromEvent).toHaveBeenCalledTimes(1)

        user.value = { id: 'student-2', role: 'student' }
        await flushPromises()
        expect(wrapper.get('button.my-reg-danger-button').element.disabled).toBe(false)
        await wrapper.get('.my-reg-danger-button').trigger('click')
        expect(unregisterFromEvent).toHaveBeenCalledTimes(2)

        if (outcome === 'success') oldAction.resolve()
        else oldAction.reject(new Error('Alter Fehler'))
        await flushPromises()
        expect(wrapper.findAll('.my-reg-card')).toHaveLength(2)
        expect(wrapper.get('button.my-reg-danger-button').element.disabled).toBe(true)
        expect(wrapper.find('.my-reg-message').exists()).toBe(false)
        expect(getMyRegistrations).toHaveBeenCalledTimes(2)

        newAction.resolve()
        await flushPromises()
        expect(wrapper.findAll('.my-reg-card')).toHaveLength(1)
        expect(wrapper.get('button.my-reg-danger-button').element.disabled).toBe(false)
        expect(wrapper.get('.my-reg-message--success').text()).toContain('wurde zurückgezogen')
        wrapper.unmount()
    })

    it('verwirft eine laufende persönliche Liste nach Rollenverlust', async () => {
        const user = mockStudentAuth()
        const pending = deferred<MyRegistration[]>()
        vi.mocked(getMyRegistrations).mockReturnValue(pending.promise)
        const wrapper = renderView()
        user.value = { id: 'student-1', role: 'organizer' }
        await nextTick()
        pending.resolve([testRegistration('Private Anmeldung')])
        await flushPromises()
        expect(wrapper.find('.my-reg-card').exists()).toBe(false)
        expect((wrapper.vm as unknown as { registrations: MyRegistration[] }).registrations).toEqual([])
        expect(getMyRegistrations).toHaveBeenCalledTimes(1)
        wrapper.unmount()
    })

    it('leert bei fehlgeschlagener Aktualisierung auch den persönlichen State', async () => {
        mockStudentAuth()
        vi.spyOn(window, 'confirm').mockReturnValue(true)
        vi.mocked(getMyRegistrations)
            .mockResolvedValueOnce([testRegistration('Privater Workshop')])
            .mockRejectedValueOnce(new Error('Session ungültig'))
            .mockResolvedValueOnce([])
        vi.mocked(unregisterFromEvent).mockRejectedValue(new Error('Netzwerkfehler'))
        const wrapper = renderView()
        await flushPromises()
        await wrapper.get('.my-reg-danger-button').trigger('click')
        await flushPromises()

        expect(getMyRegistrations).toHaveBeenCalledTimes(2)
        expect(wrapper.text()).toContain('Anmeldungen nicht verfügbar')
        expect(wrapper.find('.my-reg-card').exists()).toBe(false)
        // Die Fehleransicht allein würde eine alte Liste nur verdecken.
        const state = wrapper.vm as unknown as { registrations: MyRegistration[] }
        expect(state.registrations).toEqual([])

        await wrapper.get('.my-reg-state button').trigger('click')
        await flushPromises()
        expect(wrapper.text()).toContain('Du hast noch keine Anmeldungen')
        wrapper.unmount()
    })

    it('zeigt einen Leerzustand ohne Anmeldungen', async () => {
        mockStudentAuth()

        vi.mocked(getMyRegistrations)
            .mockResolvedValue([])

        const wrapper = renderView()
        await flushPromises()

        expect(wrapper.text()).toContain(
            'Du hast noch keine Anmeldungen',
        )

        expect(wrapper.text()).toContain(
            'Veranstaltungen entdecken',
        )

        wrapper.unmount()
    })

    it('zeigt eine bestehende Anmeldung', async () => {
        mockStudentAuth()

        vi.mocked(getMyRegistrations)
            .mockResolvedValue([
                testRegistration('CE27 Campus Sommerfest'),
            ])

        const wrapper = renderView()
        await flushPromises()

        expect(wrapper.text()).toContain(
            'CE27 Campus Sommerfest',
        )

        expect(wrapper.text()).toContain('DHBW Mosbach')
        expect(wrapper.text()).toContain('Angemeldet')

        wrapper.unmount()
    })

    it('filtert abgesagte Veranstaltungen', async () => {
        mockStudentAuth()

        vi.mocked(getMyRegistrations)
            .mockResolvedValue([
                testRegistration('CE27 Sommerfest'),
                testRegistration(
                    'CE27 Abgesagter Workshop',
                    'cancelled',
                ),
            ])

        const wrapper = renderView()
        await flushPromises()

        const filterButton = wrapper
            .findAll('button')
            .find((button) => button.text() === 'Abgesagt')

        expect(filterButton).toBeDefined()

        await filterButton!.trigger('click')

        expect(wrapper.text()).toContain(
            'CE27 Abgesagter Workshop',
        )

        expect(wrapper.text()).not.toContain(
            'CE27 Sommerfest',
        )

        wrapper.unmount()
    })

    it('verhindert Abmeldung ohne Bestätigung', async () => {
        mockStudentAuth()

        vi.mocked(getMyRegistrations)
            .mockResolvedValue([
                testRegistration('CE27 Workshop'),
            ])

        const confirmMock = vi
            .spyOn(window, 'confirm')
            .mockReturnValue(false)

        const wrapper = renderView()
        await flushPromises()

        const removeButton = wrapper
            .findAll('button')
            .find((button) =>
                button.text().includes('Anmeldung zurückziehen')
            )

        expect(removeButton).toBeDefined()

        await removeButton!.trigger('click')

        expect(unregisterFromEvent).not.toHaveBeenCalled()

        confirmMock.mockRestore()
        wrapper.unmount()
    })

    it('entfernt eine Anmeldung nach erfolgreicher Abmeldung', async () => {
        mockStudentAuth()

        vi.mocked(getMyRegistrations)
            .mockResolvedValue([
                testRegistration('CE27 Workshop'),
            ])

        vi.mocked(unregisterFromEvent)
            .mockResolvedValue()

        const confirmMock = vi
            .spyOn(window, 'confirm')
            .mockReturnValue(true)

        const wrapper = renderView()
        await flushPromises()

        const removeButton = wrapper
            .findAll('button')
            .find((button) =>
                button.text().includes('Anmeldung zurückziehen')
            )

        expect(removeButton).toBeDefined()

        await removeButton!.trigger('click')
        await flushPromises()

        expect(unregisterFromEvent)
            .toHaveBeenCalledWith('event-CE27 Workshop')

        expect(wrapper.text()).toContain(
            'wurde zurückgezogen',
        )

        expect(wrapper.text()).not.toContain(
            'Angemeldet am',
        )

        confirmMock.mockRestore()
        wrapper.unmount()
    })

    it('entfernt persönliche Daten nach Logout', async () => {
        const user = mockStudentAuth()

        vi.mocked(getMyRegistrations)
            .mockResolvedValue([
                testRegistration('CE27 Private Anmeldung'),
            ])

        const wrapper = renderView()
        await flushPromises()

        expect(wrapper.text()).toContain(
            'CE27 Private Anmeldung',
        )

        // Benutzer meldet sich ab
        user.value = null

        await nextTick()
        await flushPromises()

        // Persönliche Eventdaten dürfen nicht stehen bleiben
        expect(wrapper.text()).not.toContain(
            'CE27 Private Anmeldung',
        )

        wrapper.unmount()
    })
})
