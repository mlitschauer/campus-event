<script setup lang="ts">
import { onMounted, ref } from 'vue'

import EventCard from '../components/events/EventCard.vue'

import { getEvents } from '../services/eventService'
import { ApiError } from '../services/api'

import type { CampusEvent } from '../types/event'

// Reaktiver Zustand
const events = ref<CampusEvent[]>([])
const loading = ref(true)
const errorMessage = ref('')

// Veranstaltungen aus der REST-API laden
async function loadEvents(): Promise<void> {
  loading.value = true
  errorMessage.value = ''

  try {
    const result = await getEvents()
    events.value = result

  } catch (error) {
    events.value = []

    if (error instanceof ApiError) {
      errorMessage.value = error.message
    } else {
      errorMessage.value =
        'Die Veranstaltungen konnten nicht geladen werden.'
    }
  } finally {
    loading.value = false
  }
}

// Daten beim Aufrufen der Seite laden
onMounted(() => {
  void loadEvents()
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

    <!-- Ladezustand -->
    <section
      v-if="loading"
      aria-busy="true"
      aria-label="Veranstaltungen werden geladen"
    >
      <p class="loading-message" role="status">
        Veranstaltungen werden geladen ...
      </p>

      <div class="events-grid" aria-hidden="true">
        <div
          v-for="index in 6"
          :key="index"
          class="event-skeleton"
        >
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
    <section
      v-else-if="errorMessage"
      class="state-panel"
      role="alert"
    >
      <span class="state-icon" aria-hidden="true">⚠️</span>

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

    <!-- Leere Ergebnisliste -->
    <section
      v-else-if="events.length === 0"
      class="state-panel"
    >
      <span class="state-icon" aria-hidden="true">📅</span>

      <h2>Aktuell keine Veranstaltungen</h2>

      <p>
        Momentan sind keine veröffentlichten
        Veranstaltungen vorhanden.
        Schau später wieder vorbei.
      </p>

      <button
        type="button"
        class="button button-secondary"
        @click="loadEvents"
      >
        Aktualisieren
      </button>
    </section>

    <!-- Erfolgreich geladene Veranstaltungen -->
    <section v-else aria-label="Veranstaltungsliste">

      <div class="events-list-header">
        <h2>Alle Veranstaltungen</h2>

        <span class="event-count">
          {{ events.length }}
          {{ events.length === 1
            ? 'Veranstaltung'
            : 'Veranstaltungen' }}
        </span>
      </div>

      <div class="events-grid">
        <EventCard
          v-for="event in events"
          :key="event.id"
          :event="event"
        />
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
  background: linear-gradient(
    90deg,
    #e2e8f0 25%,
    #f1f5f9 50%,
    #e2e8f0 75%
  );
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