<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuth } from '../composables/useAuth'
import { ApiError } from '../services/api'

const route = useRoute()
const router = useRouter()
const auth = useAuth()

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')

const submitting = ref(false)
const errorMessage = ref('')

async function submit(): Promise<void> {
  if (submitting.value) return

  errorMessage.value = ''

  // Frontend-Validierung
  if (password.value !== confirmPassword.value) {
    errorMessage.value =
      'Die beiden Passwörter stimmen nicht überein.'
    return
  }

  submitting.value = true

  try {
    await auth.register({
      name: name.value.trim(),
      email: email.value.trim(),
      password: password.value,
    })

    password.value = ''
    confirmPassword.value = ''

    // Nach der Registrierung zum Login
    await router.push({
      name: 'login',
      query: {
        registered: '1',
        ...(typeof route.query.redirect === 'string'
          ? { redirect: route.query.redirect }
          : {}),
      },
    })

  } catch (error) {
    errorMessage.value =
      error instanceof ApiError
        ? error.message
        : 'Die Registrierung ist fehlgeschlagen.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-page">

    <div class="auth-panel">
      <p class="eyebrow">WERDE TEIL DER COMMUNITY</p>

      <h1>Konto erstellen</h1>

      <p class="auth-subtitle">
        Registriere dich und entdecke dein Campusleben.
      </p>

      <p
        v-if="errorMessage"
        class="auth-error"
        role="alert"
      >
        {{ errorMessage }}
      </p>

      <form class="auth-form" @submit.prevent="submit">

        <div class="auth-field">
          <label for="register-name">Dein Name</label>

          <input
            id="register-name"
            v-model="name"
            type="text"
            name="name"
            autocomplete="name"
            placeholder="Vorname Nachname"
            minlength="2"
            maxlength="80"
            required
          />
        </div>

        <div class="auth-field">
          <label for="register-email">E-Mail-Adresse</label>

          <input
            id="register-email"
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
          <label for="register-password">Passwort</label>

          <input
            id="register-password"
            v-model="password"
            type="password"
            name="password"
            autocomplete="new-password"
            minlength="15"
            maxlength="128"
            required
          />

          <span class="auth-hint">
            Mindestens 15 Zeichen. Eine längere Passphrase
            ist ebenfalls möglich.
          </span>
        </div>

        <div class="auth-field">
          <label for="register-confirm">
            Passwort bestätigen
          </label>

          <input
            id="register-confirm"
            v-model="confirmPassword"
            type="password"
            name="confirm-password"
            autocomplete="new-password"
            minlength="15"
            maxlength="128"
            required
          />
        </div>

        <button
          type="submit"
          class="button button-primary auth-submit"
          :disabled="submitting"
        >
          {{
            submitting
              ? 'Konto wird erstellt ...'
              : 'Kostenlos registrieren'
          }}
        </button>

      </form>

      <p class="auth-switch">
        Du hast bereits ein Konto?
        <RouterLink
          :to="{
            name: 'login',
            query: typeof route.query.redirect === 'string'
              ? { redirect: route.query.redirect }
              : {},
          }"
        >
          Anmelden
        </RouterLink>
      </p>

    </div>

  </div>
</template>