<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const isEventsArea = computed(() => {
  return route.path === '/events' ||
    route.path.startsWith('/events/')
})
</script>

<template>
  <header class="site-header">
    <div class="container header-inner">

      <!-- Logo -->
      <RouterLink
        to="/"
        class="brand"
        aria-label="CampusEvent – Startseite"
      >
        <span class="brand-mark">C</span>
        <span>
          Campus<span class="brand-accent">Event</span>
        </span>
      </RouterLink>

      <!-- Navigation -->
      <nav class="primary-nav" aria-label="Hauptnavigation">
        <RouterLink to="/" class="nav-link">
          Startseite
        </RouterLink>

        <RouterLink
          to="/events"
          class="nav-link"
          :class="{ active: isEventsArea }"
        >
          Veranstaltungen
        </RouterLink>
      </nav>

      <!-- Login -->
      <RouterLink
        to="/login"
        class="button button-outline header-login"
      >
        Anmelden
      </RouterLink>

    </div>
  </header>
</template>