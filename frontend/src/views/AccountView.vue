<script setup lang="ts">
import { computed } from 'vue'
import { useAuth } from '../composables/useAuth'

const { user } = useAuth()

const roleLabel = computed(() => {
  return user.value?.role === 'organizer'
    ? 'Veranstalter'
    : 'Student'
})
</script>

<template>
  <div class="page-content account-page">

    <div v-if="user">

      <section class="page-heading">
        <p class="eyebrow">MEIN CAMPUSEVENT</p>

        <h1>Hallo, {{ user.name }}!</h1>

        <p class="lead">
          Willkommen in deinem persönlichen Bereich.
        </p>
      </section>

      <section class="account-panel">
        <h2>Dein Benutzerkonto</h2>

        <dl class="account-details">

          <div>
            <dt>Name</dt>
            <dd>{{ user.name }}</dd>
          </div>

          <div>
            <dt>E-Mail-Adresse</dt>
            <dd>{{ user.email }}</dd>
          </div>

          <div>
            <dt>Benutzerrolle</dt>
            <dd>
              <span class="account-role">
                {{ roleLabel }}
              </span>
            </dd>
          </div>

        </dl>
      </section>

      <section class="account-panel">
        <h2>Dein Campusleben</h2>

        <p>
          Hier werden später deine Eventanmeldungen
          und persönlichen Funktionen angezeigt.
        </p>

        <RouterLink
          to="/events"
          class="button button-primary"
        >
          Veranstaltungen entdecken
        </RouterLink>
      </section>

    </div>

    <p v-else role="status">
      Benutzerinformationen werden geladen ...
    </p>

  </div>
</template>