<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'

import { useRoute } from 'vue-router'

import { useAuth } from '../../composables/useAuth'
import { ApiError } from '../../services/api'

import {
  getEventAvailability,
  getRegistrationStatus,
  registerForEvent,
  unregisterFromEvent,
} from '../../services/registrationService'

import type {
  EventAvailability,
  StudentRegistrationStatus,
} from '../../types/registration'

const props = defineProps<{
  eventId: string
}>()

const route = useRoute()

// Gemeinsamer Auth-State aus CE-19
const { user, status, initializeAuth } = useAuth()

const isStudent = computed(
  () => user.value?.role === 'student',
)

const availability = ref<EventAvailability | null>(null)
const personalStatus =
  ref<StudentRegistrationStatus | null>(null)

const loading = ref(true)
const loadError = ref('')

const actionError = ref('')
const actionSuccess = ref('')

const busy = ref<'register' | 'unregister' | null>(null)

// Veraltete Antworten nach Event- oder Benutzerwechsel ignorieren
let requestVersion = 0
let actionVersion = 0

async function loadStatus(): Promise<void> {
  const version = ++requestVersion

  loading.value = true
  loadError.value = ''

  try {
    if (isStudent.value) {
      // Persönlicher Status enthält auch die Belegungszahlen.
      const result = await getRegistrationStatus(
        props.eventId,
      )

      if (version !== requestVersion) return

      personalStatus.value = result
      availability.value = result
    } else {
      // Gäste und Organizer sehen nur öffentliche Daten.
      const result = await getEventAvailability(
        props.eventId,
      )

      if (version !== requestVersion) return

      personalStatus.value = null
      availability.value = result
    }
  } catch (error) {
    if (version !== requestVersion) return

    availability.value = null
    personalStatus.value = null

    loadError.value =
      error instanceof ApiError
        ? error.message
        : 'Die Teilnahmeinformationen konnten nicht geladen werden.'
  } finally {
    if (version === requestVersion) {
      loading.value = false
    }
  }
}

// Neu laden, wenn Event, Session oder Rolle wechseln.
watch(
  [
    () => props.eventId,
    () => user.value?.id ?? null,
    () => user.value?.role ?? null,
    () => status.value,
  ],
  () => {
    ++requestVersion
    ++actionVersion

    busy.value = null

    availability.value = null
    personalStatus.value = null

    actionError.value = ''
    actionSuccess.value = ''

    // Erst Session-Wiederherstellung abwarten.
    if (
      status.value === 'idle' ||
      status.value === 'loading'
    ) {
      loading.value = true
      return
    }

    void loadStatus()
  },
  { immediate: true },
)

// Auf öffentlichen Routen Auth-State bei Bedarf wiederherstellen.
onMounted(() => {
  void initializeAuth()
})

onUnmounted(() => {
  ++requestVersion
  ++actionVersion
})

// Aktuellen Belegungsgrad berechnen
const occupancyPercent = computed(() => {
  const value = availability.value

  if (!value || value.capacity <= 0) {
    return 0
  }

  return Math.min(
    100,
    Math.round(
      (value.registeredCount / value.capacity) * 100,
    ),
  )
})

// Anmeldung / Abmeldung ausführen
async function performAction(
  action: 'register' | 'unregister',
): Promise<void> {
  if (busy.value !== null || !isStudent.value || loading.value) {
    return
  }

  if (
    action === 'register' &&
    !personalStatus.value?.canRegister
  ) {
    return
  }

  if (
    action === 'unregister' &&
    !personalStatus.value?.canUnregister
  ) {
    return
  }

  if (
    action === 'unregister' &&
    !window.confirm(
      'Möchtest du deine Anmeldung wirklich zurückziehen?',
    )
  ) {
    return
  }

  const currentAction = ++actionVersion
  const currentEventId = props.eventId
  const currentUserId = user.value?.id

  const isStillCurrent = (): boolean =>
    currentAction === actionVersion &&
    props.eventId === currentEventId &&
    user.value?.id === currentUserId &&
    isStudent.value

  busy.value = action
  actionError.value = ''
  actionSuccess.value = ''

  try {
    if (action === 'register') {
      await registerForEvent(currentEventId)
    } else {
      await unregisterFromEvent(currentEventId)
    }

    if (!isStillCurrent()) return

    actionSuccess.value =
      action === 'register'
        ? 'Du bist erfolgreich für diese Veranstaltung angemeldet.'
        : 'Deine Anmeldung wurde erfolgreich zurückgezogen.'

    // Serverdaten neu laden statt Belegungszahlen selbst zu schätzen.
    await loadStatus()

  } catch (error) {
    if (!isStillCurrent()) return

    actionError.value =
      error instanceof ApiError
        ? error.message
        : 'Die Aktion konnte nicht ausgeführt werden.'

    // Nach einem möglichen Konflikt (z. B. letzter Platz vergeben)
    // die tatsächliche Belegung erneut abrufen.
    await loadStatus()
  } finally {
    if (currentAction === actionVersion) {
      busy.value = null
    }
  }
}
</script>

<template>
  <section
    class="registration-panel"
    aria-labelledby="registration-title"
  >
    <h2 id="registration-title">
      Teilnahme & Plätze
    </h2>

    <!-- Ladezustand -->
    <p v-if="loading" role="status">
      Teilnahmeinformationen werden geladen ...
    </p>

    <!-- Fehler beim Abruf -->
    <div
      v-else-if="loadError"
      class="registration-notice registration-notice--error"
      role="alert"
    >
      <p>{{ loadError }}</p>

      <button
        type="button"
        class="button button-secondary"
        @click="loadStatus"
      >
        Erneut versuchen
      </button>
    </div>

    <template v-else-if="availability">

      <!-- Belegungsanzeige -->
      <div class="registration-occupancy">
        <div class="registration-occupancy__heading">
          <strong>Belegung</strong>

          <span>
            {{ availability.registeredCount }}
            / {{ availability.capacity }} Plätze
          </span>
        </div>

        <progress
          :value="Math.min(
            availability.registeredCount,
            availability.capacity
          )"
          :max="availability.capacity"
          :aria-label="`${occupancyPercent} Prozent belegt`"
        >
          {{ occupancyPercent }} %
        </progress>

        <p class="registration-occupancy__remaining">
          <template v-if="availability.availableSeats > 0">
            {{ availability.availableSeats }}
            {{
              availability.availableSeats === 1
                ? 'Platz frei'
                : 'Plätze frei'
            }}
          </template>

          <template v-else>
            Ausgebucht
          </template>
        </p>
      </div>

      <!-- Rückmeldung zu einer Aktion -->
      <p
        v-if="actionSuccess"
        class="registration-notice registration-notice--success"
        role="status"
      >
        {{ actionSuccess }}
      </p>

      <p
        v-if="actionError"
        class="registration-notice registration-notice--error"
        role="alert"
      >
        {{ actionError }}
      </p>

      <!-- Nicht angemeldet -->
      <div v-if="!user" class="registration-action-area">
        <p>
          Melde dich an, um an dieser Veranstaltung
          teilzunehmen.
        </p>

        <RouterLink
          :to="{
            name: 'login',
            query: { redirect: route.fullPath },
          }"
          class="button button-primary"
        >
          Zum Login
        </RouterLink>
      </div>

      <!-- Organizer -->
      <div
        v-else-if="!isStudent"
        class="registration-action-area"
      >
        <p>
          Teilnehmeranmeldungen stehen aktuell
          ausschließlich Studentenaccounts zur Verfügung.
        </p>
      </div>

      <!-- Student -->
      <div
        v-else-if="personalStatus"
        class="registration-action-area"
      >
        <!-- Bereits angemeldet -->
        <template v-if="personalStatus.isRegistered">
          <p class="registration-joined">
            ✓ Du bist für diese Veranstaltung angemeldet.
          </p>

          <button
            v-if="personalStatus.canUnregister"
            type="button"
            class="button button-secondary"
            :disabled="busy !== null"
            @click="performAction('unregister')"
          >
            {{
              busy === 'unregister'
                ? 'Abmeldung läuft ...'
                : 'Anmeldung zurückziehen'
            }}
          </button>

          <p v-else class="registration-hint">
            Eine Abmeldung ist nach Veranstaltungsbeginn
            nicht mehr möglich.
          </p>
        </template>

        <!-- Noch nicht angemeldet -->
        <template v-else>
          <button
            v-if="personalStatus.canRegister"
            type="button"
            class="button button-primary"
            :disabled="busy !== null"
            @click="performAction('register')"
          >
            {{
              busy === 'register'
                ? 'Anmeldung läuft ...'
                : 'Jetzt anmelden'
            }}
          </button>

          <p v-else class="registration-hint">
            {{
              availability.availableSeats === 0
                ? 'Diese Veranstaltung ist ausgebucht.'
                : 'Die Anmeldung für diese Veranstaltung ist geschlossen.'
            }}
          </p>
        </template>
      </div>

      <p class="registration-hint">
        Die angezeigten Plätze können sich durch
        gleichzeitige Anmeldungen verändern.
      </p>
    </template>
  </section>
</template>

<style scoped>
.registration-panel {
  padding: 26px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #ffffff;
  margin-top: 28px;
}

.registration-panel h2 {
  margin: 0 0 24px;
  color: #17233b;
  font-size: 22px;
}

.registration-occupancy {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.registration-occupancy__heading {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  color: #475569;
  font-size: 14px;
}

.registration-occupancy progress {
  width: 100%;
  height: 12px;
  appearance: none;
  border: none;
  border-radius: 10px;
  overflow: hidden;
}

.registration-occupancy progress::-webkit-progress-bar {
  background: #e2e8f0;
  border-radius: 10px;
}

.registration-occupancy progress::-webkit-progress-value {
  background: #4f46e5;
  border-radius: 10px;
}

.registration-occupancy progress::-moz-progress-bar {
  background: #4f46e5;
  border-radius: 10px;
}

.registration-occupancy__remaining {
  margin: 0;
  color: #166534;
  font-size: 14px;
  font-weight: 700;
}

.registration-action-area {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  padding-top: 22px;
  border-top: 1px solid #e2e8f0;
}

.registration-action-area p {
  margin: 0;
  line-height: 1.6;
}

.registration-joined {
  color: #166534;
  font-weight: 700;
}

.registration-hint {
  color: #64748b;
  font-size: 13px;
  line-height: 1.6;
}

.registration-notice {
  margin: 16px 0;
  padding: 14px 16px;
  border-radius: 10px;
  font-size: 14px;
  line-height: 1.6;
}

.registration-notice p {
  margin-top: 0;
}

.registration-notice--success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.registration-notice--error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #b91c1c;
}

.registration-panel button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

@media (max-width: 620px) {
  .registration-panel {
    padding: 20px;
  }

  .registration-occupancy__heading {
    flex-direction: column;
    gap: 5px;
  }

  .registration-action-area .button {
    width: 100%;
    text-align: center;
    justify-content: center;
  }
}
</style>
