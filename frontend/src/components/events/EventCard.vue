<script setup lang="ts">
import { computed } from 'vue'
import type { CampusEvent } from '../../types/event'

// Event wird als Prop übergeben
const props = defineProps<{
  event: CampusEvent
}>()

// Darstellung je nach Event-Kategorie
const categoryDesign: Record<
  string,
  { icon: string; theme: string }
> = {
  party: {
    icon: '🎉',
    theme: 'party',
  },
  workshop: {
    icon: '💻',
    theme: 'workshop',
  },
  sport: {
    icon: '🏐',
    theme: 'sport',
  },
  kultur: {
    icon: '🎬',
    theme: 'kultur',
  },
  networking: {
    icon: '🤝',
    theme: 'networking',
  },
  freizeit: {
    icon: '🎮',
    theme: 'freizeit',
  },
}

const design = computed(() => {
  return categoryDesign[props.event.category.slug] ?? {
    icon: '📅',
    theme: 'default',
  }
})

// Datumsformatierung für Deutschland
const dateFormatter = new Intl.DateTimeFormat('de-DE', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Europe/Berlin',
})

const timeFormatter = new Intl.DateTimeFormat('de-DE', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: 'Europe/Berlin',
})

const formattedDate = computed(() => {
  return dateFormatter.format(new Date(props.event.startsAt))
})

const formattedTime = computed(() => {
  return timeFormatter.format(new Date(props.event.startsAt))
})
</script>

<template>
  <article class="event-card">
    <RouterLink
      :to="{
        name: 'event-detail',
        params: { id: event.id },
      }"
      class="event-card__link"
      :aria-label="`Details zu ${event.title} ansehen`"
    >
      <!-- Visueller Kartenbereich -->
      <div
        class="event-card__visual"
        :class="`event-card__visual--${design.theme}`"
        aria-hidden="true"
      >
        <span class="event-card__visual-label">
          CAMPUSEVENT
        </span>

        <span class="event-card__visual-icon">
          {{ design.icon }}
        </span>
      </div>

      <!-- Inhalt -->
      <div class="event-card__body">
        <span class="event-card__category">
          {{ event.category.name }}
        </span>

        <h3 class="event-card__title">
          {{ event.title }}
        </h3>

        <p class="event-card__description">
          {{ event.description }}
        </p>

        <div class="event-card__meta">
          <p>
            <span aria-hidden="true">📅</span>
            <time :datetime="event.startsAt">
              {{ formattedDate }} · {{ formattedTime }} Uhr
            </time>
          </p>

          <p>
            <span aria-hidden="true">📍</span>
            {{ event.location }}
          </p>

          <p>
            <span aria-hidden="true">👥</span>
            Max. {{ event.capacity }} Teilnehmende
          </p>
        </div>

        <div class="event-card__footer">
          <div class="event-card__organizer">
            <span>Veranstaltet von</span>
            <strong>{{ event.organizer.name }}</strong>
          </div>

          <span class="event-card__arrow" aria-hidden="true">
            →
          </span>
        </div>
      </div>
    </RouterLink>
  </article>
</template>
<style scoped>
.event-card {
  height: 100%;
  overflow: hidden;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 18px;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.03);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.event-card:hover,
.event-card:focus-within {
  transform: translateY(-4px);
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.1);
}

.event-card__link {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: inherit;
  text-decoration: none;
}

.event-card__link:focus-visible {
  outline: 3px solid #4f46e5;
  outline-offset: -3px;
}

/* Visuelle Eventfläche */
.event-card__visual {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 170px;
  background: linear-gradient(135deg, #e2e8f0, #f1f5f9);
}

.event-card__visual--party {
  background: linear-gradient(135deg, #ddd6fe, #f5d0fe);
}

.event-card__visual--workshop {
  background: linear-gradient(135deg, #bfdbfe, #dbeafe);
}

.event-card__visual--sport {
  background: linear-gradient(135deg, #bbf7d0, #dcfce7);
}

.event-card__visual--kultur {
  background: linear-gradient(135deg, #fecdd3, #ffe4e6);
}

.event-card__visual--networking {
  background: linear-gradient(135deg, #fde68a, #fef3c7);
}

.event-card__visual--freizeit {
  background: linear-gradient(135deg, #c7d2fe, #e0e7ff);
}

.event-card__visual-label {
  position: absolute;
  top: 16px;
  left: 18px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  color: #475569;
}

.event-card__visual-icon {
  font-size: 64px;
  line-height: 1;
}

/* Inhalt */
.event-card__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  padding: 22px;
}

.event-card__category {
  align-self: flex-start;
  padding: 5px 11px;
  border-radius: 99px;
  background: #eef2ff;
  color: #4338ca;
  font-size: 12px;
  font-weight: 700;
}

.event-card__title {
  margin: 14px 0 10px;
  font-size: 20px;
  line-height: 1.35;
  color: #17233b;
}

.event-card__description {
  display: -webkit-box;
  min-height: 44px;
  margin-bottom: 18px;
  overflow: hidden;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
  -webkit-box-orient: vertical;
  line-clamp: 2;
  -webkit-line-clamp: 2;
}

.event-card__meta {
  display: flex;
  flex-direction: column;
  gap: 11px;
  margin-bottom: 22px;
}

.event-card__meta p {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  color: #475569;
  font-size: 13px;
  line-height: 1.5;
}

.event-card__meta p > span {
  flex-shrink: 0;
}

/* Unterer Kartenbereich */
.event-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.event-card__organizer {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.event-card__organizer span {
  color: #94a3b8;
  font-size: 11px;
}

.event-card__organizer strong {
  color: #334155;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.event-card__arrow {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  border-radius: 50%;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 20px;
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  .event-card {
    transition: none;
  }

  .event-card:hover,
  .event-card:focus-within {
    transform: none;
  }
}
</style>