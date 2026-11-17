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


      <section class="account-hub-card">

        <!-- ORGANIZER -->
        <template v-if="user?.role === 'organizer'">
          <div class="account-hub-header">
            <div class="account-hub-icon">
              <span aria-hidden="true">▦</span>
            </div>

            <div>
              <h2>Deine Veranstaltungen</h2>
              <p>
                Verwalte deine Campus-Events und
                erstelle neue Veranstaltungen.
              </p>
            </div>
          </div>

          <div class="account-hub-actions">
            <RouterLink :to="{ name: 'organizer-dashboard' }" class="account-hub-button account-hub-button--primary">
              Meine Veranstaltungen
            </RouterLink>

            <RouterLink :to="{ name: 'organizer-event-new' }" class="account-hub-button account-hub-button--secondary">
              <span aria-hidden="true">+</span>
              Neue Veranstaltung
            </RouterLink>
          </div>
        </template>

        <!-- STUDENT -->
        <template v-else-if="user?.role === 'student'">
          <div class="account-hub-header">
            <div class="account-hub-icon">
              <span aria-hidden="true">▦</span>
            </div>

            <div>
              <h2>Dein Campusleben</h2>
              <p>
                Entdecke Veranstaltungen auf dem Campus
                und verwalte deine Anmeldungen.
              </p>
            </div>
          </div>

          <div class="account-hub-actions">
            <RouterLink :to="{ name: 'my-registrations' }" class="account-hub-button account-hub-button--primary">
              Meine Anmeldungen
            </RouterLink>

            <RouterLink to="/events" class="account-hub-button account-hub-button--secondary">
              Veranstaltungen entdecken
            </RouterLink>
          </div>
        </template>

      </section>

    </div>

    <p v-else role="status">
      Benutzerinformationen werden geladen ...
    </p>
  </div>
</template>

<style scoped>
/* Account – Veranstaltungsbereich */

.account-hub-card {
  margin-top: 20px;
  padding: 24px;
  background: #ffffff;
  border: 1px solid #dce3ef;
  border-radius: 14px;
}

.account-hub-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.account-hub-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  width: 44px;
  height: 44px;

  background: #eef2ff;
  color: #4f46e5;

  border-radius: 12px;
  font-size: 24px;
  font-weight: 700;
}

.account-hub-header h2 {
  margin: 0 0 8px;
  color: #102044;
  font-size: 18px;
  font-weight: 700;
}

.account-hub-header p {
  margin: 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
}

.account-hub-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 22px;
}

.account-hub-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;

  min-height: 42px;
  padding: 11px 16px;

  border: 1px solid transparent;
  border-radius: 9px;

  font-size: 13px;
  font-weight: 600;
  text-decoration: none;

  transition:
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.account-hub-button--primary {
  background: #4f46e5;
  color: #ffffff;
}

.account-hub-button--primary:hover {
  background: #4338ca;
}

.account-hub-button--secondary {
  background: #ffffff;
  border-color: #cbd5e1;
  color: #334155;
}

.account-hub-button--secondary:hover {
  background: #f8fafc;
  border-color: #94a3b8;
}

.account-hub-button:focus-visible {
  outline: 3px solid #818cf8;
  outline-offset: 3px;
}

/* Smartphone */
@media (max-width: 620px) {
  .account-hub-card {
    padding: 20px;
  }

  .account-hub-header {
    gap: 12px;
  }

  .account-hub-actions {
    flex-direction: column;
  }

  .account-hub-button {
    width: 100%;
  }
}
</style>