<script setup lang="ts">
import {
  computed,
  onUnmounted,
  ref,
  watch,
} from 'vue'

import {
  useRoute,
  useRouter,
} from 'vue-router'

import EventForm from '../components/events/EventForm.vue'

import {
  createOrganizerEvent,
  updateOrganizerEvent,
  getOrganizerEventById,
  getEventFormCategories,
} from '../services/organizerEventService'

import { ApiError } from '../services/api'

import type { CampusEvent } from '../types/event'

import type {
  EventFormInput,
  EventFormCategory,
} from '../types/eventManagement'

const route = useRoute()
const router = useRouter()

const eventId = computed(() =>
  typeof route.params.id === 'string'
    ? route.params.id
    : null,
)

const isEditing = computed(() =>
  eventId.value !== null,
)

// Daten
const categories = ref<EventFormCategory[]>([])
const event = ref<CampusEvent | null>(null)

// Ladezustand
const loading = ref(true)
const loadError = ref('')

// Speicherzustand
const saving = ref(false)
const saveError = ref('')

const serverFieldErrors = ref<
  Record<string, string>
>({})

// Schutz vor veralteten Leseanfragen
let latestLoadId = 0

async function loadForm(): Promise<void> {
  const loadId = ++latestLoadId
  const id = eventId.value

  loading.value = true
  loadError.value = ''
  saveError.value = ''
  serverFieldErrors.value = {}

  try {
    // Kategorien und ggf. bestehendes Event parallel laden
    const [loadedCategories, loadedEvent] = await Promise.all([
      getEventFormCategories(),

      id
        ? getOrganizerEventById(id)
        : Promise.resolve(null),
    ])

    if (loadId !== latestLoadId) return

    if (loadedCategories.length === 0) {
      loadError.value =
        'Es sind keine Kategorien verfügbar.'
      return
    }

    // Nur eigene Entwürfe bearbeiten
    if (
      loadedEvent &&
      loadedEvent.status !== 'draft'
    ) {
      loadError.value =
        'Nur Entwürfe können bearbeitet werden.'
      return
    }

    categories.value = loadedCategories
    event.value = loadedEvent

  } catch (error) {
    if (loadId !== latestLoadId) return

    loadError.value =
      error instanceof ApiError
        ? error.message
        : 'Die Formulardaten konnten nicht geladen werden.'

  } finally {
    if (loadId === latestLoadId) {
      loading.value = false
    }
  }
}

// Beim direkten Aufruf und bei Routenänderungen laden
watch(
  () => route.fullPath,
  () => {
    void loadForm()
  },
  { immediate: true },
)

onUnmounted(() => {
  latestLoadId++
})

// Event erstellen oder bearbeiten
async function saveEvent(
  input: EventFormInput,
): Promise<void> {
  if (saving.value) return

  saving.value = true
  saveError.value = ''
  serverFieldErrors.value = {}

  let saved = false

  try {
    if (isEditing.value) {
      const id = eventId.value

      if (!id) {
        throw new Error('Event-ID fehlt.')
      }

      await updateOrganizerEvent(id, input)
    } else {
      await createOrganizerEvent(input)
    }

    saved = true

  } catch (error) {
    if (error instanceof ApiError) {
      saveError.value = error.message

      // Feldfehler aus Zod übernehmen
      serverFieldErrors.value = Object.fromEntries(
        error.details.map((detail) => [
          detail.field,
          detail.message,
        ]),
      )
    } else {
      saveError.value =
        'Die Veranstaltung konnte nicht gespeichert werden.'
    }

  } finally {
    saving.value = false
  }

  if (saved) {
    await router.replace({
      name: 'organizer-dashboard',
    })
  }
}
</script>

<template>
  <div class="page-content organizer-editor-page">

    <RouterLink
      :to="{ name: 'organizer-dashboard' }"
      class="organizer-editor-back"
    >
      ← Zurück zu meinen Veranstaltungen
    </RouterLink>

    <section class="page-heading">
      <p class="eyebrow">VERANSTALTERBEREICH</p>

      <h1>
        {{
          isEditing
            ? 'Veranstaltung bearbeiten'
            : 'Neue Veranstaltung'
        }}
      </h1>

      <p class="lead">
        {{
          isEditing
            ? 'Bearbeite die Angaben deines Entwurfs.'
            : 'Erstelle eine neue Veranstaltung als Entwurf.'
        }}
      </p>
    </section>

    <!-- Laden -->
    <div
      v-if="loading"
      class="organizer-editor-panel"
      role="status"
    >
      Formulardaten werden geladen ...
    </div>

    <!-- Fehler -->
    <div
      v-else-if="loadError"
      class="organizer-editor-panel"
      role="alert"
    >
      <h2>Formular nicht verfügbar</h2>

      <p>{{ loadError }}</p>

      <div class="organizer-editor-actions">
        <button
          type="button"
          class="button button-primary"
          @click="loadForm"
        >
          Erneut versuchen
        </button>

        <RouterLink
          :to="{ name: 'organizer-dashboard' }"
          class="button button-secondary"
        >
          Zum Dashboard
        </RouterLink>
      </div>
    </div>

    <!-- Formular -->
    <section
      v-else
      class="organizer-editor-panel"
    >
      <div class="organizer-editor-info">
        <strong>
          {{
            isEditing
              ? 'Entwurf bearbeiten'
              : 'Neuen Entwurf erstellen'
          }}
        </strong>

        <p>
          Deine Änderungen werden gespeichert.
          Die Veranstaltung wird dadurch nicht automatisch
          veröffentlicht.
        </p>
      </div>

      <EventForm
        :mode="isEditing ? 'edit' : 'create'"
        :event="event"
        :categories="categories"
        :submitting="saving"
        :server-error="saveError"
        :server-field-errors="serverFieldErrors"
        @submit="saveEvent"
      />
    </section>

  </div>
</template>

<style scoped>
.organizer-editor-page {
  max-width: 920px;
  padding-top: 36px;
  padding-bottom: 80px;
}

.organizer-editor-back {
  display: inline-flex;
  margin-bottom: 28px;
  color: #4f46e5;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.organizer-editor-back:hover {
  text-decoration: underline;
}

.organizer-editor-panel {
  padding: 32px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #ffffff;
}

.organizer-editor-info {
  margin-bottom: 30px;
  padding: 18px;
  border: 1px solid #c7d2fe;
  border-radius: 12px;
  background: #eef2ff;
}

.organizer-editor-info strong {
  color: #3730a3;
  font-size: 14px;
}

.organizer-editor-info p {
  margin: 8px 0 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.6;
}

.organizer-editor-panel h2 {
  margin-top: 0;
}

.organizer-editor-panel > p {
  color: #64748b;
  line-height: 1.7;
}

.organizer-editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

@media (max-width: 620px) {
  .organizer-editor-panel {
    padding: 20px;
  }

  .organizer-editor-info {
    padding: 14px;
  }

  .organizer-editor-actions {
    flex-direction: column;
  }
}
</style>