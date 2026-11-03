<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
} from 'vue'

import {
  useRoute,
  useRouter,
} from 'vue-router'

import { useAuth } from '../../composables/useAuth'
import { ApiError } from '../../services/api'

const route = useRoute()
const router = useRouter()

const {
  user,
  status,
  initializeAuth,
  logout,
} = useAuth()

const loggingOut = ref(false)
const logoutError = ref('')

const isEventsArea = computed(() => {
  return route.path === '/events' ||
    route.path.startsWith('/events/')
})

// Beim Start der Anwendung Session überprüfen
onMounted(() => {
  void initializeAuth()
})

async function handleLogout(): Promise<void> {
  if (loggingOut.value) return

  loggingOut.value = true
  logoutError.value = ''

  try {
    await logout()

    // Nach erfolgreichem Logout zur Startseite
    await router.replace({ name: 'home' })

  } catch (error) {
    logoutError.value =
      error instanceof ApiError
        ? error.message
        : 'Die Abmeldung ist fehlgeschlagen.'
  } finally {
    loggingOut.value = false
  }
}
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

      <!-- Hauptnavigation -->
      <nav
        class="primary-nav"
        aria-label="Hauptnavigation"
      >
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

        <RouterLink
          v-if="user"
          to="/account"
          class="nav-link"
        >
          Mein Konto
        </RouterLink>
      </nav>

      <!-- Benutzerbereich -->
      <div class="header-actions">

        <!-- Session wird überprüft -->
        <span
          v-if="status === 'idle' || status === 'loading'"
          class="header-status"
          role="status"
        >
          Session wird geprüft ...
        </span>

        <!-- Angemeldeter Benutzer -->
        <template v-else-if="user">

          <span class="header-username">
            {{ user.name }}
          </span>

          <button
            type="button"
            class="button button-outline"
            :disabled="loggingOut"
            @click="handleLogout"
          >
            {{
              loggingOut
                ? 'Abmelden ...'
                : 'Abmelden'
            }}
          </button>

        </template>

        <!-- Gast -->
        <RouterLink
          v-else
          to="/login"
          class="button button-primary header-login"
        >
          Anmelden
        </RouterLink>

      </div>
    </div>

    <div
      v-if="logoutError"
      class="container header-error"
      role="alert"
    >
      {{ logoutError }}
    </div>

  </header>
</template>

<style scoped>
.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-username {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

.header-status {
  color: #64748b;
  font-size: 12px;
}

.header-actions button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.header-error {
  padding-bottom: 12px;
  color: #b91c1c;
  font-size: 13px;
}

@media (max-width: 768px) {
  .header-actions {
    margin-left: auto;
  }

  .header-username {
    display: none;
  }
}

@media (max-width: 390px) {
  .header-actions .button {
    padding: 10px 12px;
  }
}
</style>