<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuth } from '../composables/useAuth'
import { ApiError } from '../services/api'

const route = useRoute()
const router = useRouter()

const auth = useAuth()

const email = ref('')
const password = ref('')

const submitting = ref(false)
const errorMessage = ref('')

// Benutzer kam direkt von der Registrierung
const registrationSuccessful = computed(
  () => route.query.registered === '1',
)

// Registrierungslink erhält den ursprünglichen Zielpfad
const registerLink = computed(() => ({
  name: 'register',
  query: typeof route.query.redirect === 'string'
    ? { redirect: route.query.redirect }
    : {},
}))

async function submit(): Promise<void> {
  if (submitting.value) return

  submitting.value = true
  errorMessage.value = ''

  try {
    await auth.login({
      email: email.value.trim(),
      password: password.value,
    })

    // Passwort nicht länger im Formular behalten
    password.value = ''

    // Nur interne Weiterleitungsziele akzeptieren
    const requestedRedirect = route.query.redirect

    const safeRedirect =
      typeof requestedRedirect === 'string' &&
      requestedRedirect.startsWith('/') &&
      !requestedRedirect.startsWith('//') &&
      !requestedRedirect.includes('\\')

    if (safeRedirect) {
      await router.replace(requestedRedirect)
    } else {
      await router.replace({ name: 'account' })
    }

  } catch (error) {
    errorMessage.value =
      error instanceof ApiError
        ? error.message
        : 'Die Anmeldung ist fehlgeschlagen.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-page">

    <div class="auth-panel">
      <p class="eyebrow">CAMPUSEVENT ACCOUNT</p>

      <h1>Willkommen zurück!</h1>

      <p class="auth-subtitle">
        Melde dich an und werde Teil des Campuslebens.
      </p>

      <!-- Erfolgreiche Registrierung -->
      <p
        v-if="registrationSuccessful"
        class="auth-success"
        role="status"
      >
        Dein Konto wurde erstellt. Du kannst dich jetzt anmelden.
      </p>

      <!-- Sessionprüfung fehlgeschlagen -->
      <p
        v-if="auth.status.value === 'error'"
        class="auth-notice"
        role="status"
      >
        Dein bisheriger Anmeldestatus konnte nicht geprüft werden.
        Du kannst versuchen, dich erneut anzumelden.
      </p>

      <!-- Loginfehler -->
      <p
        v-if="errorMessage"
        class="auth-error"
        role="alert"
      >
        {{ errorMessage }}
      </p>

      <form class="auth-form" @submit.prevent="submit">

        <div class="auth-field">
          <label for="login-email">E-Mail-Adresse</label>

          <input
            id="login-email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            placeholder="name@beispiel.de"
            maxlength="254"
            required
          />
        </div>

        <div class="auth-field">
          <label for="login-password">Passwort</label>

          <input
            id="login-password"
            v-model="password"
            type="password"
            name="password"
            autocomplete="current-password"
            placeholder="Dein Passwort"
            required
          />
        </div>

        <button
          type="submit"
          class="button button-primary auth-submit"
          :disabled="submitting"
        >
          {{ submitting ? 'Anmeldung läuft ...' : 'Anmelden' }}
        </button>

      </form>

      <p class="auth-switch">
        Noch kein Konto?
        <RouterLink :to="registerLink">
          Jetzt registrieren
        </RouterLink>
      </p>
    </div>

  </div>
</template>