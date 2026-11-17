<script setup lang="ts">
import {
  computed,
  onUnmounted,
  ref,
  watch,
} from 'vue'

import { useRouter } from 'vue-router'

import { useAuth } from '../composables/useAuth'
import { ApiError } from '../services/api'

import {
  getMyRegistrations,
  unregisterFromEvent,
} from '../services/registrationService'

import type {
  MyRegistration,
} from '../types/registration'

type RegistrationFilter =
  | 'all'
  | 'upcoming'
  | 'past'
  | 'cancelled'

const router = useRouter()
const { user } = useAuth()

const registrations = ref<MyRegistration[]>([])

const loading = ref(true)
const loadError = ref('')

const actionError = ref('')
const actionSuccess = ref('')

const selectedFilter = ref<RegistrationFilter>('all')
const busyEventId = ref<string | null>(null)

let requestVersion = 0
let actionVersion = 0

const filters: Array<{
  value: RegistrationFilter
  label: string
}> = [
  { value: 'all', label: 'Alle' },
  { value: 'upcoming', label: 'Bevorstehend' },
  { value: 'past', label: 'Vergangen' },
  { value: 'cancelled', label: 'Abgesagt' },
]

// Datumsformatierung
const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Berlin',
})

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value))
}

// Unterscheiden, ob ein Event schon begonnen hat
function hasStarted(
  registration: MyRegistration,
): boolean {
  return (
    new Date(registration.event.startsAt).getTime() <=
    Date.now()
  )
}

// Abmelden ist nach CE-24 bis Veranstaltungsbeginn erlaubt,
// auch wenn eine Veranstaltung bereits abgesagt wurde.
function canUnregister(
  registration: MyRegistration,
): boolean {
  return !hasStarted(registration)
}

// Anmeldungen nach Status filtern
const filteredRegistrations = computed(() => {
  switch (selectedFilter.value) {
    case 'upcoming':
      return registrations.value.filter(
        (registration) =>
          registration.event.status === 'published' &&
          !hasStarted(registration),
      )

    case 'past':
      return registrations.value.filter(
        (registration) =>
          registration.event.status !== 'cancelled' &&
          hasStarted(registration),
      )

    case 'cancelled':
      return registrations.value.filter(
        (registration) =>
          registration.event.status === 'cancelled',
      )

    default:
      return registrations.value
  }
})

// Persönliche Anmeldungen laden
async function loadRegistrations(): Promise<void> {
  const version = ++requestVersion

  loading.value = true
  loadError.value = ''

  try {
    const result = await getMyRegistrations()

    if (version !== requestVersion) return

    registrations.value = result
  } catch (error) {
    if (version !== requestVersion) return

    // Bei fehlgeschlagenem Abruf keine veralteten persönlichen Daten behalten.
    registrations.value = []

    loadError.value =
      error instanceof ApiError
        ? error.message
        : 'Deine Anmeldungen konnten nicht geladen werden.'
  } finally {
    if (version === requestVersion) {
      loading.value = false
    }
  }
}

// Sessionwechsel berücksichtigen.
// Bei einem Logout keine alten persönlichen Daten stehen lassen.
watch(
  () => user.value?.id ?? null,
  (userId, previousUserId) => {
    ++requestVersion
    ++actionVersion

    registrations.value = []
    busyEventId.value = null

    actionError.value = ''
    actionSuccess.value = ''

    if (userId) {
      void loadRegistrations()
    } else if (previousUserId) {
      void router.replace({
        name: 'login',
        query: { redirect: '/my-registrations' },
      })
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  ++requestVersion
  ++actionVersion
})

// Eigene Anmeldung zurückziehen
async function removeRegistration(
  registration: MyRegistration,
): Promise<void> {
  if (
    busyEventId.value !== null ||
    !canUnregister(registration)
  ) {
    return
  }

  const confirmed = window.confirm(
    `Möchtest du deine Anmeldung für "${registration.event.title}" ` +
    'wirklich zurückziehen?',
  )

  if (!confirmed) return

  const currentAction = ++actionVersion
  const currentUserId = user.value?.id
  const eventId = registration.event.id

  const isStillCurrent = (): boolean =>
    currentAction === actionVersion &&
    user.value?.id === currentUserId &&
    user.value?.role === 'student'

  busyEventId.value = eventId
  actionError.value = ''
  actionSuccess.value = ''

  try {
    await unregisterFromEvent(eventId)

    // Ergebnis einer alten Session ignorieren.
    if (!isStillCurrent()) return

    // Registrierung unmittelbar aus der Liste entfernen.
    registrations.value = registrations.value.filter(
      (item) => item.id !== registration.id,
    )

    actionSuccess.value =
      `Deine Anmeldung für "${registration.event.title}" ` +
      'wurde zurückgezogen.'
  } catch (error) {
    if (!isStillCurrent()) return

    actionError.value =
      error instanceof ApiError
        ? error.message
        : 'Die Anmeldung konnte nicht zurückgezogen werden.'

    // Der Serverzustand ist maßgeblich.
    await loadRegistrations()
  } finally {
    if (currentAction === actionVersion) {
      busyEventId.value = null
    }
  }
}
</script>

<template>
  <div class="page-content my-registrations-page">

    <section class="page-heading">
      <p class="eyebrow">MEIN CAMPUSEVENT</p>

      <h1>Meine Anmeldungen</h1>

      <p class="lead">
        Hier findest du alle Veranstaltungen,
        für die du dich angemeldet hast.
      </p>
    </section>

    <!-- Erfolgs- und Fehlermeldungen -->
    <p
      v-if="actionSuccess"
      class="my-reg-message my-reg-message--success"
      role="status"
    >
      {{ actionSuccess }}
    </p>

    <p
      v-if="actionError"
      class="my-reg-message my-reg-message--error"
      role="alert"
    >
      {{ actionError }}
    </p>

    <!-- Laden -->
    <section
      v-if="loading"
      class="my-reg-state"
      role="status"
    >
      Anmeldungen werden geladen ...
    </section>

    <!-- Fehler beim Laden -->
    <section
      v-else-if="loadError"
      class="my-reg-state"
      role="alert"
    >
      <h2>Anmeldungen nicht verfügbar</h2>

      <p>{{ loadError }}</p>

      <button
        type="button"
        class="button button-primary"
        @click="loadRegistrations"
      >
        Erneut versuchen
      </button>
    </section>

    <template v-else>

      <!-- Filter -->
      <div class="my-reg-filters">
        <button
          v-for="filter in filters"
          :key="filter.value"
          type="button"
          class="my-reg-filter"
          :class="{
            'my-reg-filter--active':
              selectedFilter === filter.value
          }"
          :aria-pressed="selectedFilter === filter.value"
          @click="selectedFilter = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>

      <!-- Noch keine Anmeldungen -->
      <section
        v-if="registrations.length === 0"
        class="my-reg-state"
      >
        <span class="my-reg-state__icon" aria-hidden="true">
          📅
        </span>

        <h2>Du hast noch keine Anmeldungen</h2>

        <p>
          Entdecke Veranstaltungen auf dem Campus
          und melde dich für ein Event an.
        </p>

        <RouterLink
          to="/events"
          class="button button-primary"
        >
          Veranstaltungen entdecken
        </RouterLink>
      </section>

      <!-- Filter ohne Ergebnis -->
      <section
        v-else-if="filteredRegistrations.length === 0"
        class="my-reg-state"
      >
        <h2>Keine passenden Anmeldungen</h2>

        <p>
          In dieser Kategorie sind aktuell
          keine Anmeldungen vorhanden.
        </p>

        <button
          type="button"
          class="button button-secondary"
          @click="selectedFilter = 'all'"
        >
          Alle Anmeldungen anzeigen
        </button>
      </section>

      <!-- Anmeldeliste -->
      <section
        v-else
        class="my-reg-list"
        aria-label="Eigene Veranstaltungsanmeldungen"
      >
        <article
          v-for="registration in filteredRegistrations"
          :key="registration.id"
          class="my-reg-card"
        >
          <div class="my-reg-card__header">
            <div>
              <span class="my-reg-category">
                {{ registration.event.category.name }}
              </span>

              <h2>{{ registration.event.title }}</h2>
            </div>

            <span
              class="my-reg-badge"
              :class="{
                'my-reg-badge--cancelled':
                  registration.event.status === 'cancelled'
              }"
            >
              {{
                registration.event.status === 'cancelled'
                  ? 'Abgesagt'
                  : hasStarted(registration)
                    ? 'Vergangen'
                    : 'Angemeldet'
              }}
            </span>
          </div>

          <p class="my-reg-description">
            {{ registration.event.description }}
          </p>

          <div class="my-reg-facts">
            <span>
              📅 {{ formatDate(registration.event.startsAt) }}
            </span>

            <span>
              📍 {{ registration.event.location }}
            </span>

            <span>
              ✓ Angemeldet am
              {{ formatDate(registration.registeredAt) }}
            </span>
          </div>

          <p
            v-if="registration.event.status === 'cancelled'"
            class="my-reg-warning"
          >
            Diese Veranstaltung wurde vom Veranstalter abgesagt.
          </p>

          <div class="my-reg-actions">
            <!-- Nur veröffentlichte Events sind öffentlich sichtbar -->
            <RouterLink
              v-if="registration.event.status === 'published'"
              :to="{
                name: 'event-detail',
                params: { id: registration.event.id },
              }"
              class="button button-secondary"
            >
              Event ansehen
            </RouterLink>

            <!-- Eigene Anmeldung zurückziehen -->
            <button
              v-if="canUnregister(registration)"
              type="button"
              class="my-reg-danger-button"
              :disabled="busyEventId !== null"
              @click="removeRegistration(registration)"
            >
              {{
                busyEventId === registration.event.id
                  ? 'Bitte warten ...'
                  : 'Anmeldung zurückziehen'
              }}
            </button>

            <span
              v-else
              class="my-reg-hint"
            >
              Abmeldung nicht mehr möglich
            </span>
          </div>
        </article>
      </section>

    </template>
  </div>
</template>

<style scoped>
.my-registrations-page {
  padding-top: 36px;
  padding-bottom: 80px;
}

.my-reg-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 28px 0;
}

.my-reg-filter {
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  color: #475569;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.my-reg-filter--active {
  border-color: #4f46e5;
  background: #eef2ff;
  color: #4338ca;
}

.my-reg-filter:focus-visible,
.my-reg-danger-button:focus-visible {
  outline: 3px solid #818cf8;
  outline-offset: 3px;
}

.my-reg-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.my-reg-card {
  padding: 26px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #ffffff;
  min-width: 0;
}

.my-reg-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.my-reg-card__header > div {
  min-width: 0;
}

.my-reg-card h2 {
  margin: 8px 0 12px;
  color: #17233b;
  font-size: 21px;
  overflow-wrap: anywhere;
}

.my-reg-category {
  color: #4f46e5;
  font-size: 12px;
  font-weight: 700;
}

.my-reg-badge {
  padding: 7px 12px;
  border-radius: 99px;
  background: #dcfce7;
  color: #166534;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.my-reg-badge--cancelled {
  background: #fee2e2;
  color: #991b1b;
}

.my-reg-description {
  margin: 0 0 18px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

.my-reg-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 22px;
  color: #475569;
  font-size: 13px;
}

.my-reg-warning {
  padding: 12px 14px;
  border-radius: 10px;
  background: #fef2f2;
  color: #991b1b;
  font-size: 13px;
}

.my-reg-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
}

.my-reg-danger-button {
  min-height: 42px;
  padding: 10px 16px;
  border: 1px solid #fecaca;
  border-radius: 10px;
  background: #fff7f7;
  color: #b91c1c;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.my-reg-danger-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.my-reg-hint {
  color: #64748b;
  font-size: 13px;
}

.my-reg-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  padding: 36px 24px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #ffffff;
  text-align: center;
}

.my-reg-state__icon {
  font-size: 40px;
}

.my-reg-state p {
  max-width: 450px;
  color: #64748b;
  line-height: 1.7;
}

.my-reg-message {
  padding: 14px 16px;
  border-radius: 10px;
  margin: 18px 0;
  font-size: 14px;
}

.my-reg-message--success {
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  color: #166534;
}

.my-reg-message--error {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}

@media (max-width: 620px) {
  .my-reg-card {
    padding: 20px;
  }

  .my-reg-card__header {
    flex-direction: column;
  }

  .my-reg-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .my-reg-actions .button,
  .my-reg-danger-button {
    width: 100%;
    text-align: center;
    justify-content: center;
  }
}
</style>
