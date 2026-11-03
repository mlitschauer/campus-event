<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'

import EventCard from '../components/events/EventCard.vue'
import EventFilters from '../components/events/EventFilters.vue'

import { getEvents } from '../services/eventService'
import { getCategories } from '../services/categoryService'
import { ApiError } from '../services/api'

import type {
  CampusEvent,
  EventFilters as EventFilterParams,
} from '../types/event'

import type { Category } from '../types/category'

// Veranstaltungsdaten
const events = ref<CampusEvent[]>([])
const categories = ref<Category[]>([])

// Filterzustand
const searchTerm = ref('')
const selectedCategory = ref('')

// Lade- und Fehlerzustand
const loading = ref(true)
const errorMessage = ref('')
const categoriesError = ref('')

// Sind aktuell Filter aktiv?
const hasActiveFilters = computed(() => {
  return Boolean(
    searchTerm.value.trim() ||
    selectedCategory.value
  )
})

// Steuerung der Suchverzögerung
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Verhindert, dass ältere API-Antworten neue überschreiben
let requestId = 0

// Kategorien laden
async function loadCategories(): Promise<void> {
  try {
    categories.value = await getCategories()
    categoriesError.value = ''
  } catch {
    categoriesError.value =
      'Kategorien konnten nicht geladen werden.'
  }
}

// Veranstaltungen mit aktuellen Filtern laden
async function loadEvents(id: number): Promise<void> {
  const filters: EventFilterParams = {}

  if (selectedCategory.value) {
    filters.category = selectedCategory.value
  }

  const search = searchTerm.value.trim()

  if (search) {
    filters.search = search
  }

  try {
    const result = await getEvents(filters)

    // Veraltete Antworten nicht übernehmen
    if (id !== requestId) return

    events.value = result

  } catch (error) {
    if (id !== requestId) return

    events.value = []

    errorMessage.value =
      error instanceof ApiError
        ? error.message
        : 'Veranstaltungen konnten nicht geladen werden.'

  } finally {
    if (id === requestId) {
      loading.value = false
    }
  }
}

// API-Anfrage planen
function scheduleLoad(delay = 0): void {
  // Vorherige Anfrage ungültig machen
  requestId++

  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  const currentRequest = requestId

  loading.value = true
  errorMessage.value = ''

  if (delay === 0) {
    void loadEvents(currentRequest)
    return
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void loadEvents(currentRequest)
  }, delay)
}

// Bei Filteränderungen neu laden
watch(
  [searchTerm, selectedCategory],
  ([, newCategory], [, oldCategory]) => {

    // Kategorie sofort, Suche verzögert
    const delay = newCategory !== oldCategory ? 0 : 350

    scheduleLoad(delay)
  }
)

// Filter zurücksetzen
function resetFilters(): void {
  searchTerm.value = ''
  selectedCategory.value = ''
}

// Erneut laden
function retryLoad(): void {
  scheduleLoad(0)
}

// Initialisierung
onMounted(() => {
  void loadCategories()
  scheduleLoad(0)
})

// Aufräumen beim Verlassen der Seite
onUnmounted(() => {
  requestId++

  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
  }
})
</script>

<template>
  <div class="page-content events-view">

    <!-- Seitenüberschrift -->
    <section class="page-heading">
      <p class="eyebrow">ENTDECKEN</p>

      <h1>Veranstaltungen entdecken</h1>

      <p class="lead">
        Ob Partys, Workshops, Sport oder Networking:
        Entdecke, was auf deinem Campus los ist.
      </p>
    </section>

    <!-- Such- und Filterbereich -->
    <EventFilters v-model:search="searchTerm" v-model:category="selectedCategory" :categories="categories"
      @reset="resetFilters" />

    <!-- Fehler beim Laden der Kategorien -->
    <p v-if="categoriesError" class="categories-error" role="status">
      {{ categoriesError }}
    </p>

    <!-- Ladezustand -->
    <section v-if="loading" aria-busy="true" aria-label="Veranstaltungen werden geladen">
      <p class="loading-message" role="status">
        Veranstaltungen werden geladen ...
      </p>

      <div class="events-grid" aria-hidden="true">
        <div v-for="index in 6" :key="index" class="event-skeleton">
          <div class="skeleton-visual"></div>

          <div class="skeleton-content">
            <div class="skeleton-line skeleton-short"></div>
            <div class="skeleton-line skeleton-title"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line skeleton-medium"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Fehlerzustand -->
    <section v-else-if="errorMessage" class="state-panel" role="alert">
      <span class="state-icon" aria-hidden="true">⚠️</span>

      <h2>Veranstaltungen nicht verfügbar</h2>

      <p>{{ errorMessage }}</p>

      <button type="button" class="button button-primary" @click="retryLoad">
        Erneut versuchen
      </button>
    </section>

    <!-- Keine passenden Veranstaltungen -->
    <section v-else-if="events.length === 0" class="state-panel">
      <span class="state-icon" aria-hidden="true">🔎</span>

      <h2>
        {{ hasActiveFilters
          ? 'Keine passenden Veranstaltungen'
          : 'Aktuell keine Veranstaltungen' }}
      </h2>

      <p v-if="hasActiveFilters">
        Für deine Suche konnten keine passenden
        Veranstaltungen gefunden werden.
        Versuche andere Suchbegriffe oder Kategorien.
      </p>

      <p v-else>
        Momentan sind keine veröffentlichten
        Veranstaltungen verfügbar.
        Schau später wieder vorbei.
      </p>

      <button v-if="hasActiveFilters" type="button" class="button button-primary" @click="resetFilters">
        Filter zurücksetzen
      </button>

      <button v-else type="button" class="button button-secondary" @click="retryLoad">
        Aktualisieren
      </button>
    </section>

    <!-- Eventübersicht -->
    <section v-else aria-label="Veranstaltungsliste">

      <div class="events-list-header">
        <h2>
          {{ hasActiveFilters
            ? 'Suchergebnisse'
            : 'Alle Veranstaltungen' }}
        </h2>

        <span class="event-count" role="status">
          {{ events.length }}
          {{ events.length === 1
            ? 'Veranstaltung'
            : 'Veranstaltungen' }}
        </span>
      </div>

      <div class="events-grid">
        <EventCard v-for="event in events" :key="event.id" :event="event" />
      </div>

    </section>

  </div>
</template>

<style scoped>
.events-view {
  min-height: 70vh;
}

/* Überschrift über dem Event-Grid */
.events-list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
}

.events-list-header h2 {
  margin: 0;
  font-size: 23px;
}

.event-count {
  display: inline-flex;
  align-items: center;
  padding: 7px 14px;
  border-radius: 99px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

/* Responsives Event-Grid */
.events-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  align-items: stretch;
}

/* Fehler- und Leerzustand */
.state-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  padding: 48px 24px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #ffffff;
  text-align: center;
}

.state-icon {
  margin-bottom: 16px;
  font-size: 42px;
}

.state-panel h2 {
  margin-bottom: 12px;
}

.state-panel p {
  max-width: 450px;
  margin-bottom: 24px;
  color: #64748b;
}

/* Skeleton Loading */
.loading-message {
  margin-bottom: 20px;
  color: #64748b;
}

.event-skeleton {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #ffffff;
}

.skeleton-visual {
  height: 170px;
  background: #e2e8f0;
}

.skeleton-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 22px;
}

.skeleton-line {
  height: 14px;
  width: 100%;
  border-radius: 6px;
  background: linear-gradient(90deg,
      #e2e8f0 25%,
      #f1f5f9 50%,
      #e2e8f0 75%);
  background-size: 200% 100%;
  animation: skeleton-loading 1.5s infinite;
}

.skeleton-short {
  width: 35%;
}

.skeleton-medium {
  width: 65%;
}

.skeleton-title {
  width: 90%;
  height: 24px;
}

@keyframes skeleton-loading {
  from {
    background-position: 200% 0;
  }

  to {
    background-position: -200% 0;
  }
}

/* Tablet */
@media (max-width: 950px) {
  .events-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
  }
}

/* Smartphone */
@media (max-width: 620px) {
  .events-grid {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .events-list-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .state-panel {
    padding: 36px 18px;
  }
}

/* Barrierefreiheit: weniger Animation */
@media (prefers-reduced-motion: reduce) {
  .skeleton-line {
    animation: none;
  }
}
</style>