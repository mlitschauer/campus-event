<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from 'vue'

import {
  getOrganizerEvents,
  publishOrganizerEvent,
  cancelOrganizerEvent,
  deleteOrganizerEvent,
} from '../services/organizerEventService'

import { ApiError } from '../services/api'

import type {
  CampusEvent,
  EventStatus,
} from '../types/event'

type StatusFilter = 'all' | EventStatus
type EventAction = 'publish' | 'cancel' | 'delete'

// Veranstaltungsdaten
const events = ref<CampusEvent[]>([])

// UI-Zustand
const loading = ref(true)
const errorMessage = ref('')
const actionError = ref('')
const actionSuccess = ref('')

const selectedFilter = ref<StatusFilter>('all')
const busyEventId = ref<string | null>(null)

// Ältere Listen-Anfragen nicht mehr übernehmen
let latestLoadId = 0

// Filteroptionen
const filterOptions: Array<{
  value: StatusFilter
  label: string
}> = [
  { value: 'all', label: 'Alle' },
  { value: 'draft', label: 'Entwürfe' },
  { value: 'published', label: 'Veröffentlicht' },
  { value: 'cancelled', label: 'Abgesagt' },
]

// Dashboard-Kennzahlen
const counts = computed(() => ({
  all: events.value.length,

  draft: events.value.filter(
    (event) => event.status === 'draft',
  ).length,

  published: events.value.filter(
    (event) => event.status === 'published',
  ).length,

  cancelled: events.value.filter(
    (event) => event.status === 'cancelled',
  ).length,
}))

// Lokal ausgewählte Statusansicht
const filteredEvents = computed(() => {
  if (selectedFilter.value === 'all') {
    return events.value
  }

  return events.value.filter(
    (event) => event.status === selectedFilter.value,
  )
})

// Status ins Deutsche übersetzen
function statusLabel(status: EventStatus): string {
  switch (status) {
    case 'draft':
      return 'Entwurf'

    case 'published':
      return 'Veröffentlicht'

    case 'cancelled':
      return 'Abgesagt'
  }
}

// Datum und Uhrzeit formatieren
const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Berlin',
})

function formatDate(value: string): string {
  return dateFormatter.format(new Date(value))
}

// Veranstaltungen aus dem Backend laden
async function loadEvents(): Promise<void> {
  const loadId = ++latestLoadId

  loading.value = true
  errorMessage.value = ''

  try {
    const result = await getOrganizerEvents()

    if (loadId !== latestLoadId) return

    events.value = result
  } catch (error) {
    if (loadId !== latestLoadId) return

    errorMessage.value =
      error instanceof ApiError
        ? error.message
        : 'Deine Veranstaltungen konnten nicht geladen werden.'
  } finally {
    if (loadId === latestLoadId) {
      loading.value = false
    }
  }
}

// Nach erfolgreicher Änderung lokale Daten aktualisieren
function replaceEvent(updated: CampusEvent): void {
  events.value = events.value.map((event) =>
    event.id === updated.id ? updated : event
  )
}

// Eventaktionen ausführen
async function performAction(
  event: CampusEvent,
  action: EventAction,
): Promise<void> {
  if (busyEventId.value !== null) return

  let question = ''

  if (action === 'publish') {
    question =
      `"${event.title}" jetzt veröffentlichen? ` +
      'Die Veranstaltung wird öffentlich sichtbar.'
  }

  if (action === 'cancel') {
    question =
      `"${event.title}" wirklich absagen? ` +
      'Die Veranstaltung kann anschließend nicht erneut ' +
      'veröffentlicht werden.'
  }

  if (action === 'delete') {
    question =
      `Den Entwurf "${event.title}" endgültig löschen? ` +
      'Dieser Vorgang kann nicht rückgängig gemacht werden.'
  }

  // Benutzer muss die Aktion bestätigen
  if (!window.confirm(question)) return

  busyEventId.value = event.id
  actionError.value = ''
  actionSuccess.value = ''

  try {
    if (action === 'publish') {
      const updated = await publishOrganizerEvent(event.id)

      replaceEvent(updated)

      actionSuccess.value =
        `"${event.title}" wurde veröffentlicht.`
    }

    if (action === 'cancel') {
      const updated = await cancelOrganizerEvent(event.id)

      replaceEvent(updated)

      actionSuccess.value =
        `"${event.title}" wurde abgesagt.`
    }

    if (action === 'delete') {
      await deleteOrganizerEvent(event.id)

      events.value = events.value.filter(
        (item) => item.id !== event.id,
      )

      actionSuccess.value =
        `"${event.title}" wurde gelöscht.`
    }

  } catch (error) {
    actionError.value =
      error instanceof ApiError
        ? error.message
        : 'Die Aktion konnte nicht durchgeführt werden.'
  } finally {
    busyEventId.value = null
  }
}

onMounted(() => {
  void loadEvents()
})

onUnmounted(() => {
  // Noch laufende Leseanfragen entwerten
  latestLoadId++
})
</script>

<template>
  <div class="page-content dashboard-page">

    <!-- Seitenüberschrift -->
    <section class="page-heading">
      <p class="eyebrow">VERANSTALTERBEREICH</p>

      <h1>Meine Veranstaltungen</h1>

      <p class="lead">
        Behalte deine Events im Blick und verwalte
        Veröffentlichungen und Absagen.
      </p>
    </section>

    <!-- Feedback für Verwaltungsaktionen -->
    <p
      v-if="actionSuccess"
      class="dashboard-message dashboard-message--success"
      role="status"
    >
      {{ actionSuccess }}
    </p>

    <p
      v-if="actionError"
      class="dashboard-message dashboard-message--error"
      role="alert"
    >
      {{ actionError }}
    </p>

    <!-- Ladezustand -->
    <section v-if="loading" aria-busy="true">
      <p role="status">Dashboard wird geladen ...</p>

      <div class="dashboard-skeletons" aria-hidden="true">
        <div
          v-for="index in 3"
          :key="index"
          class="dashboard-skeleton"
        ></div>
      </div>
    </section>

    <!-- Fehler beim Laden -->
    <section
      v-else-if="errorMessage"
      class="dashboard-state"
      role="alert"
    >
      <span class="dashboard-state__icon" aria-hidden="true">
        ⚠️
      </span>

      <h2>Veranstaltungen nicht verfügbar</h2>

      <p>{{ errorMessage }}</p>

      <button
        type="button"
        class="button button-primary"
        @click="loadEvents"
      >
        Erneut versuchen
      </button>
    </section>

    <template v-else>

      <!-- Dashboard-Kennzahlen -->
      <section
        class="dashboard-stats"
        aria-label="Veranstaltungsstatistik"
      >
        <div class="dashboard-stat">
          <span>📝 Entwürfe</span>
          <strong>{{ counts.draft }}</strong>
        </div>

        <div class="dashboard-stat">
          <span>✅ Veröffentlicht</span>
          <strong>{{ counts.published }}</strong>
        </div>

        <div class="dashboard-stat">
          <span>❌ Abgesagt</span>
          <strong>{{ counts.cancelled }}</strong>
        </div>
      </section>

      <!-- Filter -->
      <section aria-label="Veranstaltungen nach Status filtern">

        <div class="dashboard-filter-header">
          <h2>Veranstaltungsübersicht</h2>

          <span>
            {{ counts.all }}
            {{ counts.all === 1
              ? 'Veranstaltung'
              : 'Veranstaltungen' }}
          </span>
        </div>

        <div class="dashboard-filters">
          <button
            v-for="filter in filterOptions"
            :key="filter.value"
            type="button"
            class="dashboard-filter"
            :class="{
              'dashboard-filter--active':
                selectedFilter === filter.value
            }"
            :aria-pressed="selectedFilter === filter.value"
            @click="selectedFilter = filter.value"
          >
            {{ filter.label }}
            <span>{{ counts[filter.value] }}</span>
          </button>
        </div>

      </section>

      <!-- Noch keine Events -->
      <section
        v-if="events.length === 0"
        class="dashboard-state"
      >
        <span class="dashboard-state__icon" aria-hidden="true">
          📅
        </span>

        <h2>Du hast noch keine Veranstaltungen</h2>

        <p>
          Sobald du ein Event erstellt hast, wird es
          hier in deinem Dashboard angezeigt.
        </p>

        <p class="dashboard-hint">
          Das Formular zum Erstellen neuer Events
          ergänzen wir in CE-23.
        </p>
      </section>

      <!-- Keine Ergebnisse im gewählten Statusfilter -->
      <section
        v-else-if="filteredEvents.length === 0"
        class="dashboard-state"
      >
        <span class="dashboard-state__icon" aria-hidden="true">
          🔎
        </span>

        <h2>Keine Veranstaltungen gefunden</h2>

        <p>
          Du hast aktuell keine Veranstaltungen
          mit diesem Status.
        </p>

        <button
          type="button"
          class="button button-secondary"
          @click="selectedFilter = 'all'"
        >
          Alle Veranstaltungen anzeigen
        </button>
      </section>

      <!-- Eigene Eventliste -->
      <section
        v-else
        class="dashboard-event-list"
        aria-label="Meine Veranstaltungen"
      >

        <article
          v-for="event in filteredEvents"
          :key="event.id"
          class="dashboard-event"
        >
          <div class="dashboard-event__header">

            <div>
              <span class="dashboard-event__category">
                {{ event.category.name }}
              </span>

              <h3>{{ event.title }}</h3>
            </div>

            <span
              class="dashboard-status"
              :class="`dashboard-status--${event.status}`"
            >
              {{ statusLabel(event.status) }}
            </span>

          </div>

          <p class="dashboard-event__description">
            {{ event.description }}
          </p>

          <div class="dashboard-event__facts">

            <span>
              📅 {{ formatDate(event.startsAt) }}
            </span>

            <span>
              📍 {{ event.location }}
            </span>

            <span>
              👥 Max. {{ event.capacity }} Personen
            </span>

          </div>

          <div class="dashboard-event__actions">

            <!-- Entwurf veröffentlichen -->
            <button
              v-if="event.status === 'draft'"
              type="button"
              class="button button-primary"
              :disabled="busyEventId !== null"
              @click="performAction(event, 'publish')"
            >
              {{
                busyEventId === event.id
                  ? 'Bitte warten ...'
                  : 'Veröffentlichen'
              }}
            </button>

            <!-- Entwurf endgültig löschen -->
            <button
              v-if="event.status === 'draft'"
              type="button"
              class="dashboard-danger-button"
              :disabled="busyEventId !== null"
              @click="performAction(event, 'delete')"
            >
              Entwurf löschen
            </button>

            <!-- Veröffentlichtes Event ansehen -->
            <RouterLink
              v-if="event.status === 'published'"
              :to="{
                name: 'event-detail',
                params: { id: event.id },
              }"
              class="button button-secondary"
            >
              Öffentlich ansehen
            </RouterLink>

            <!-- Veröffentlichtes Event absagen -->
            <button
              v-if="event.status === 'published'"
              type="button"
              class="dashboard-danger-button"
              :disabled="busyEventId !== null"
              @click="performAction(event, 'cancel')"
            >
              {{
                busyEventId === event.id
                  ? 'Bitte warten ...'
                  : 'Veranstaltung absagen'
              }}
            </button>

            <!-- Bereits abgesagtes Event -->
            <span
              v-if="event.status === 'cancelled'"
              class="dashboard-cancelled-note"
            >
              Diese Veranstaltung wurde abgesagt.
            </span>

          </div>
        </article>

      </section>
    </template>

  </div>
</template>

<style scoped>
.dashboard-page {
  padding-top: 36px;
  padding-bottom: 80px;
}

/* Kennzahlen */
.dashboard-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-bottom: 36px;
}

.dashboard-stat {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #ffffff;
}

.dashboard-stat span {
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
}

.dashboard-stat strong {
  color: #17233b;
  font-size: 36px;
  line-height: 1;
}

/* Filter */
.dashboard-filter-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.dashboard-filter-header h2 {
  margin: 0;
  font-size: 23px;
}

.dashboard-filter-header > span {
  color: #64748b;
  font-size: 13px;
}

.dashboard-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 26px;
}

.dashboard-filter {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 10px 15px;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #ffffff;
  color: #475569;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.dashboard-filter:hover {
  background: #f8fafc;
}

.dashboard-filter--active {
  border-color: #4f46e5;
  background: #eef2ff;
  color: #4338ca;
}

.dashboard-filter span {
  display: inline-grid;
  place-items: center;
  min-width: 24px;
  padding: 3px 6px;
  border-radius: 7px;
  background: #f1f5f9;
  font-size: 11px;
}

.dashboard-filter--active span {
  background: #c7d2fe;
}

.dashboard-filter:focus-visible,
.dashboard-danger-button:focus-visible {
  outline: 3px solid #818cf8;
  outline-offset: 3px;
}

/* Eventliste */
.dashboard-event-list {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.dashboard-event {
  min-width: 0;
  padding: 26px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #ffffff;
}

.dashboard-event__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.dashboard-event__header > div {
  min-width: 0;
}

.dashboard-event__category {
  color: #4f46e5;
  font-size: 12px;
  font-weight: 700;
}

.dashboard-event h3 {
  margin: 8px 0 12px;
  color: #17233b;
  font-size: 21px;
  overflow-wrap: anywhere;
}

.dashboard-event__description {
  margin-bottom: 18px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.7;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.dashboard-event__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 22px;
  margin-bottom: 24px;
  color: #475569;
  font-size: 13px;
}

/* Status-Badges */
.dashboard-status {
  display: inline-flex;
  align-items: center;
  padding: 7px 12px;
  border-radius: 99px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.dashboard-status--draft {
  background: #f1f5f9;
  color: #475569;
}

.dashboard-status--published {
  background: #dcfce7;
  color: #166534;
}

.dashboard-status--cancelled {
  background: #fee2e2;
  color: #991b1b;
}

/* Eventaktionen */
.dashboard-event__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
}

.dashboard-event__actions .button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.dashboard-event__actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.dashboard-danger-button {
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

.dashboard-danger-button:hover:not(:disabled) {
  background: #fee2e2;
}

.dashboard-cancelled-note,
.dashboard-hint {
  color: #64748b;
  font-size: 13px;
}

/* Lade-, Fehler- und Leerzustände */
.dashboard-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 280px;
  padding: 40px 24px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #ffffff;
  text-align: center;
}

.dashboard-state__icon {
  margin-bottom: 16px;
  font-size: 44px;
}

.dashboard-state h2 {
  margin-bottom: 12px;
}

.dashboard-state p {
  max-width: 460px;
  color: #64748b;
  line-height: 1.7;
}

.dashboard-state .button {
  margin-top: 12px;
}

.dashboard-message {
  margin-bottom: 24px;
  padding: 14px 18px;
  border-radius: 10px;
  font-size: 14px;
}

.dashboard-message--success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.dashboard-message--error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.dashboard-skeletons {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 20px;
}

.dashboard-skeleton {
  height: 125px;
  border-radius: 16px;
  background: linear-gradient(
    90deg,
    #e2e8f0 25%,
    #f1f5f9 50%,
    #e2e8f0 75%
  );
  background-size: 200% 100%;
  animation: dashboard-shimmer 1.5s infinite;
}

@keyframes dashboard-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

/* Tablet */
@media (max-width: 850px) {
  .dashboard-stats,
  .dashboard-skeletons {
    gap: 12px;
  }

  .dashboard-stat {
    padding: 18px;
  }
}

/* Smartphone */
@media (max-width: 620px) {
  .dashboard-stats,
  .dashboard-skeletons {
    grid-template-columns: 1fr;
  }

  .dashboard-stat {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .dashboard-stat strong {
    font-size: 28px;
  }

  .dashboard-filter-header,
  .dashboard-event__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .dashboard-event {
    padding: 20px;
  }

  .dashboard-event__actions {
    align-items: stretch;
    flex-direction: column;
  }

  .dashboard-event__actions .button,
  .dashboard-danger-button {
    width: 100%;
    justify-content: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dashboard-skeleton {
    animation: none;
  }
}
</style>