<script setup lang="ts">
import {
  computed,
  onUnmounted,
  ref,
  watch,
} from 'vue'

import { getEventById } from '../services/eventService'
import { ApiError } from '../services/api'

import type { CampusEvent } from '../types/event'

// Die Event-ID wird über Vue Router übergeben
const props = defineProps<{
  id: string
}>()

// Mögliche Zustände der Detailseite
type PageStatus =
  | 'loading'
  | 'success'
  | 'not-found'
  | 'invalid-id'
  | 'error'

// Reaktiver Zustand
const event = ref<CampusEvent | null>(null)
const status = ref<PageStatus>('loading')
const errorMessage = ref('')

// Verhindert, dass veraltete API-Antworten angezeigt werden
let latestRequestId = 0

// Veranstaltung laden
async function loadEvent(id: string): Promise<void> {
  const requestId = ++latestRequestId

  status.value = 'loading'
  event.value = null
  errorMessage.value = ''

  try {
    const result = await getEventById(id)

    // Veraltete Antworten ignorieren
    if (requestId !== latestRequestId) return

    event.value = result
    status.value = 'success'

    // Browser-Titel aktualisieren
    document.title = `${result.title} | CampusEvent`

  } catch (error) {
    if (requestId !== latestRequestId) return

    if (error instanceof ApiError) {
      if (error.status === 404) {
        status.value = 'not-found'
        return
      }

      if (error.status === 400) {
        status.value = 'invalid-id'
        return
      }

      errorMessage.value = error.message
    } else {
      errorMessage.value =
        'Die Veranstaltung konnte nicht geladen werden.'
    }

    status.value = 'error'
  }
}

// Bei Fehler erneut laden
function retryLoad(): void {
  void loadEvent(props.id)
}

// Event laden, sobald sich die ID verändert
watch(
  () => props.id,
  (id) => {
    void loadEvent(id)
  },
  { immediate: true },
)

// Offene Anfragen beim Verlassen der Seite entwerten
onUnmounted(() => {
  latestRequestId++
})

// Kategorieabhängige Darstellung
const categoryDesign: Record<
  string,
  { icon: string; theme: string }
> = {
  party: { icon: '🎉', theme: 'party' },
  workshop: { icon: '💻', theme: 'workshop' },
  sport: { icon: '🏐', theme: 'sport' },
  kultur: { icon: '🎬', theme: 'kultur' },
  networking: { icon: '🤝', theme: 'networking' },
  freizeit: { icon: '🎮', theme: 'freizeit' },
}

const design = computed(() => {
  const slug = event.value?.category.slug ?? ''

  return categoryDesign[slug] ?? {
    icon: '📅',
    theme: 'default',
  }
})

// Deutsche Datums- und Uhrzeitformatierung
const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Berlin',
})

const timeFormatter = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Berlin',
})

const startDate = computed(() =>
  event.value
    ? dateFormatter.format(new Date(event.value.startsAt))
    : '',
)

const endDate = computed(() =>
  event.value
    ? dateFormatter.format(new Date(event.value.endsAt))
    : '',
)

const startTime = computed(() =>
  event.value
    ? timeFormatter.format(new Date(event.value.startsAt))
    : '',
)

const endTime = computed(() =>
  event.value
    ? timeFormatter.format(new Date(event.value.endsAt))
    : '',
)
</script>

<template>
  <div class="page-content event-detail">

    <!-- Navigation zurück zur Eventübersicht -->
    <nav class="detail-back" aria-label="Zurück">
      <RouterLink to="/events" class="detail-back__link">
        <span aria-hidden="true">←</span>
        Zurück zu den Veranstaltungen
      </RouterLink>
    </nav>

    <!-- LADEZUSTAND -->
    <section
      v-if="status === 'loading'"
      class="detail-loading"
      aria-busy="true"
      aria-label="Veranstaltung wird geladen"
    >
      <p role="status">
        Veranstaltungsdetails werden geladen ...
      </p>

      <div
        class="detail-skeleton detail-skeleton--hero"
        aria-hidden="true"
      ></div>

      <div class="detail-grid" aria-hidden="true">
        <div class="detail-skeleton detail-skeleton--content"></div>
        <div class="detail-skeleton detail-skeleton--sidebar"></div>
      </div>
    </section>

    <!-- EVENT NICHT GEFUNDEN ODER ID UNGÜLTIG -->
    <section
      v-else-if="
        status === 'not-found' ||
        status === 'invalid-id'
      "
      class="detail-state"
      role="status"
    >
      <span class="detail-state__icon" aria-hidden="true">
        🔎
      </span>

      <h1>
        {{
          status === 'invalid-id'
            ? 'Ungültiger Veranstaltungslink'
            : 'Veranstaltung nicht gefunden'
        }}
      </h1>

      <p v-if="status === 'invalid-id'">
        Der Veranstaltungslink enthält keine gültige Event-ID.
      </p>

      <p v-else>
        Die Veranstaltung existiert nicht oder
        ist momentan nicht öffentlich verfügbar.
      </p>

      <RouterLink to="/events" class="button button-primary">
        Alle Veranstaltungen ansehen
      </RouterLink>
    </section>

    <!-- FEHLERZUSTAND -->
    <section
      v-else-if="status === 'error'"
      class="detail-state"
      role="alert"
    >
      <span class="detail-state__icon" aria-hidden="true">
        ⚠️
      </span>

      <h1>Veranstaltung nicht verfügbar</h1>

      <p>{{ errorMessage }}</p>

      <button
        type="button"
        class="button button-primary"
        @click="retryLoad"
      >
        Erneut versuchen
      </button>
    </section>

    <!-- ERFOLGREICH GELADENES EVENT -->
    <template v-else-if="event">

      <!-- Event-Hero -->
      <section
        class="detail-hero"
        :class="`detail-hero--${design.theme}`"
      >
        <span class="detail-hero__label">
          CAMPUSEVENT · {{ event.category.name }}
        </span>

        <span
          class="detail-hero__icon"
          aria-hidden="true"
        >
          {{ design.icon }}
        </span>

        <div class="detail-hero__content">
          <span class="detail-category">
            {{ event.category.name }}
          </span>

          <h1>{{ event.title }}</h1>

          <p>
            Organisiert von
            <strong>{{ event.organizer.name }}</strong>
          </p>
        </div>
      </section>

      <div class="detail-grid">

        <!-- Hauptinhalt -->
        <article class="detail-panel detail-description">
          <h2>Über die Veranstaltung</h2>

          <p class="detail-description__text">
            {{ event.description }}
          </p>

          <div class="detail-organizer">
            <h3>Veranstalter</h3>

            <div class="detail-organizer__profile">
              <div
                class="detail-organizer__avatar"
                aria-hidden="true"
              >
                {{ event.organizer.name.charAt(0).toUpperCase() }}
              </div>

              <div>
                <strong>{{ event.organizer.name }}</strong>
                <span>Veranstalter auf CampusEvent</span>
              </div>
            </div>
          </div>
        </article>

        <!-- Seitenleiste -->
        <aside class="detail-sidebar">

          <div class="detail-panel">
            <h2>Auf einen Blick</h2>

            <dl class="detail-facts">

              <!-- Beginn -->
              <div class="detail-fact">
                <dt>
                  <span aria-hidden="true">📅</span>
                  Beginn
                </dt>

                <dd>
                  <time :datetime="event.startsAt">
                    {{ startDate }}
                    <span>{{ startTime }} Uhr</span>
                  </time>
                </dd>
              </div>

              <!-- Ende -->
              <div class="detail-fact">
                <dt>
                  <span aria-hidden="true">🕒</span>
                  Ende
                </dt>

                <dd>
                  <time :datetime="event.endsAt">
                    {{ endDate }}
                    <span>{{ endTime }} Uhr</span>
                  </time>
                </dd>
              </div>

              <!-- Ort -->
              <div class="detail-fact">
                <dt>
                  <span aria-hidden="true">📍</span>
                  Veranstaltungsort
                </dt>

                <dd>{{ event.location }}</dd>
              </div>

              <!-- Kapazität -->
              <div class="detail-fact">
                <dt>
                  <span aria-hidden="true">👥</span>
                  Teilnehmerkapazität
                </dt>

                <dd>
                  Maximal {{ event.capacity }} Personen
                </dd>
              </div>

              <!-- Kategorie -->
              <div class="detail-fact">
                <dt>
                  <span aria-hidden="true">🏷️</span>
                  Kategorie
                </dt>

                <dd>{{ event.category.name }}</dd>
              </div>

            </dl>
          </div>

          <!-- Anmeldung wird später implementiert -->
          <div class="detail-registration">
            <h3>Du möchtest teilnehmen?</h3>

            <p>
              Die Anmeldung zu Veranstaltungen
              wird in einer späteren Projektphase
              verfügbar sein.
            </p>
          </div>

        </aside>

      </div>

    </template>

  </div>
</template>

<style scoped>
/* Grundlayout */
.event-detail {
  padding-top: 32px;
  padding-bottom: 80px;
}

/* Zurück-Navigation */
.detail-back {
  margin-bottom: 24px;
}

.detail-back__link {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
}

.detail-back__link:hover {
  color: #4f46e5;
}

.detail-back__link:focus-visible {
  outline: 3px solid #818cf8;
  outline-offset: 4px;
  border-radius: 4px;
}

/* Event-Hero */
.detail-hero {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  min-height: 340px;
  padding: 36px 42px;
  overflow: hidden;
  border-radius: 24px;
  background: linear-gradient(135deg, #e0e7ff, #ede9fe);
}

.detail-hero--party {
  background: linear-gradient(135deg, #ddd6fe, #f5d0fe);
}

.detail-hero--workshop {
  background: linear-gradient(135deg, #bfdbfe, #dbeafe);
}

.detail-hero--sport {
  background: linear-gradient(135deg, #bbf7d0, #dcfce7);
}

.detail-hero--kultur {
  background: linear-gradient(135deg, #fecdd3, #ffe4e6);
}

.detail-hero--networking {
  background: linear-gradient(135deg, #fde68a, #fef3c7);
}

.detail-hero--freizeit {
  background: linear-gradient(135deg, #c7d2fe, #e0e7ff);
}

.detail-hero__label {
  position: absolute;
  top: 24px;
  left: 28px;
  color: #475569;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.detail-hero__icon {
  position: absolute;
  top: 50%;
  right: 11%;
  transform: translateY(-50%);
  font-size: clamp(80px, 12vw, 145px);
  line-height: 1;
  opacity: 0.85;
}

.detail-hero__content {
  position: relative;
  z-index: 1;
  max-width: 68%;
}

.detail-category {
  display: inline-block;
  margin-bottom: 14px;
  padding: 7px 14px;
  border-radius: 99px;
  background: rgba(255, 255, 255, 0.8);
  color: #4338ca;
  font-size: 12px;
  font-weight: 700;
}

.detail-hero h1 {
  margin-bottom: 14px;
  color: #17233b;
  font-size: clamp(30px, 4vw, 48px);
  line-height: 1.15;
  overflow-wrap: anywhere;
}

.detail-hero p {
  margin: 0;
  color: #475569;
  font-size: 14px;
}

/* Zweispaltiger Inhaltsbereich */
.detail-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 1fr);
  align-items: start;
  gap: 24px;
  margin-top: 28px;
}

.detail-panel {
  min-width: 0;
  padding: 30px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #ffffff;
}

.detail-panel h2 {
  margin-bottom: 24px;
  color: #17233b;
  font-size: 22px;
}

/* Beschreibung */
.detail-description__text {
  color: #475569;
  font-size: 15px;
  line-height: 1.85;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

/* Veranstalter */
.detail-organizer {
  margin-top: 36px;
  padding-top: 24px;
  border-top: 1px solid #e2e8f0;
}

.detail-organizer h3 {
  margin-bottom: 18px;
  font-size: 17px;
}

.detail-organizer__profile {
  display: flex;
  align-items: center;
  gap: 14px;
}

.detail-organizer__avatar {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  border-radius: 14px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 20px;
  font-weight: 800;
}

.detail-organizer__profile > div:last-child {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.detail-organizer__profile strong {
  font-size: 14px;
  overflow-wrap: anywhere;
}

.detail-organizer__profile span {
  color: #64748b;
  font-size: 12px;
}

/* Seitenleiste */
.detail-sidebar {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.detail-facts {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: 0;
}

.detail-fact {
  padding-bottom: 18px;
  border-bottom: 1px solid #f1f5f9;
}

.detail-fact:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.detail-fact dt {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
}

.detail-fact dd {
  margin: 0 0 0 30px;
  color: #17233b;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.detail-fact time {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-fact time span {
  color: #475569;
  font-weight: 500;
}

/* Hinweis zur zukünftigen Anmeldung */
.detail-registration {
  padding: 24px;
  border: 1px solid #c7d2fe;
  border-radius: 16px;
  background: #eef2ff;
}

.detail-registration h3 {
  margin-bottom: 10px;
  color: #312e81;
  font-size: 17px;
}

.detail-registration p {
  margin-bottom: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.7;
}

/* Fehler- und Nicht-gefunden-Zustände */
.detail-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 420px;
  padding: 48px 24px;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  background: #ffffff;
  text-align: center;
}

.detail-state__icon {
  margin-bottom: 20px;
  font-size: 50px;
}

.detail-state h1 {
  margin-bottom: 16px;
  font-size: clamp(26px, 4vw, 36px);
}

.detail-state p {
  max-width: 480px;
  margin-bottom: 26px;
  color: #64748b;
}

/* Skeleton Loading */
.detail-loading > p {
  color: #64748b;
  margin-bottom: 16px;
}

.detail-skeleton {
  border-radius: 18px;
  background: linear-gradient(
    90deg,
    #e2e8f0 25%,
    #f1f5f9 50%,
    #e2e8f0 75%
  );
  background-size: 200% 100%;
  animation: detail-shimmer 1.5s infinite;
}

.detail-skeleton--hero {
  min-height: 340px;
  border-radius: 24px;
}

.detail-skeleton--content {
  min-height: 300px;
}

.detail-skeleton--sidebar {
  min-height: 380px;
}

@keyframes detail-shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

/* Tablet */
@media (max-width: 860px) {
  .detail-grid {
    grid-template-columns: 1fr;
  }

  .detail-hero__content {
    max-width: 75%;
  }
}

/* Smartphone */
@media (max-width: 620px) {
  .event-detail {
    padding-top: 24px;
  }

  .detail-hero {
    min-height: 300px;
    padding: 90px 22px 28px;
    border-radius: 18px;
  }

  .detail-hero__label {
    top: 20px;
    left: 22px;
  }

  .detail-hero__icon {
    top: 82px;
    right: 24px;
    transform: none;
    font-size: 64px;
    opacity: 0.55;
  }

  .detail-hero__content {
    max-width: 100%;
  }

  .detail-panel {
    padding: 22px;
  }

  .detail-grid {
    gap: 18px;
    margin-top: 18px;
  }

  .detail-state {
    padding: 40px 20px;
    min-height: 350px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .detail-skeleton {
    animation: none;
  }
}
</style>