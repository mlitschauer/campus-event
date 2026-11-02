<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { ApiError } from '../services/api'
import { getEvents, getEventById } from '../services/eventService'
import { getCategories } from '../services/categoryService'

import type { CampusEvent } from '../types/event'
import type { Category } from '../types/category'

// Reaktiver Zustand
const events = ref<CampusEvent[]>([])
const categories = ref<Category[]>([])
const selectedEvent = ref<CampusEvent | null>(null)
const filteredCount = ref(0)

const loading = ref(false)
const errorMessage = ref('')
const notFoundResult = ref('')

// Daten abrufen
async function loadData() {
  loading.value = true
  errorMessage.value = ''

  try {
    const [
      loadedEvents,
      loadedCategories,
      demoEvent,
      filteredEvents,
    ] = await Promise.all([
      getEvents(),
      getCategories(),
      getEventById(
        '00000000-0000-4000-8000-000000000101'
      ),
      getEvents({
        category: 'party',
        search: 'semester',
      }),
    ])

    events.value = loadedEvents
    categories.value = loadedCategories
    selectedEvent.value = demoEvent
    filteredCount.value = filteredEvents.length

  } catch (error) {
    if (error instanceof ApiError) {
      errorMessage.value =
        `${error.code} (HTTP ${error.status}): ${error.message}`
    } else {
      errorMessage.value = 'Unbekannter Fehler beim Laden.'
    }
  } finally {
    loading.value = false
  }
}

// HTTP-404-Fehlerbehandlung prüfen
async function testNotFound() {
  notFoundResult.value = ''

  try {
    await getEventById(
      '00000000-0000-4000-8000-000000000999'
    )

    notFoundResult.value = 'Fehler: Event unerwartet gefunden.'
  } catch (error) {
    if (error instanceof ApiError &&
        error.status === 404 &&
        error.code === 'EVENT_NOT_FOUND') {
      notFoundResult.value = 'HTTP 404 korrekt verarbeitet.'
    } else {
      notFoundResult.value = 'Unerwarteter Fehler aufgetreten.'
    }
  }
}

onMounted(() => {
  void loadData()
})
</script>

<template>
  <section class="info-panel api-check">
    <h2>API-Datentest (CE-12)</h2>

    <p v-if="loading" role="status">
      Daten werden geladen ...
    </p>

    <p v-else-if="errorMessage" role="alert">
      {{ errorMessage }}
    </p>

    <div v-else>
      <p><strong>Events:</strong> {{ events.length }}</p>
      <p><strong>Kategorien:</strong> {{ categories.length }}</p>
      <p><strong>Party + Semester:</strong> {{ filteredCount }}</p>

      <p>
        <strong>Einzelnes Event:</strong>
        {{ selectedEvent?.title }}
      </p>

      <h3>Geladene Veranstaltungen</h3>

      <ul>
        <li v-for="event in events" :key="event.id">
          {{ event.title }} – {{ event.category.name }}
        </li>
      </ul>
    </div>

    <button type="button" :disabled="loading" @click="loadData">
      Daten erneut laden
    </button>

    <button type="button" @click="testNotFound">
      HTTP 404 testen
    </button>

    <p v-if="notFoundResult" role="status">
      {{ notFoundResult }}
    </p>
  </section>
</template>

<style scoped>
.api-check {
  margin-top: 24px;
}

button {
  margin: 8px 12px 8px 0;
  padding: 10px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>