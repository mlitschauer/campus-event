<script setup lang="ts">
import ApiStatus from '../components/ApiStatus.vue'

// Technischen Status nur während der Entwicklung zeigen
const showDevelopmentStatus = import.meta.env.DEV
</script>

<template>
  <div class="page-content">

    <!-- Hero -->
    <section class="hero">
      <div class="hero-content">
        <p class="eyebrow">DEIN CAMPUS. DEINE EVENTS.</p>

        <h1>
          Entdecke das
          <span>Campusleben.</span>
        </h1>

        <p class="lead">
          Finde spannende Veranstaltungen, lerne neue
          Leute kennen und erlebe mehr außerhalb
          deiner Vorlesungen.
        </p>

        <div class="hero-actions">
          <RouterLink
            to="/events"
            class="button button-primary"
          >
            Events entdecken
          </RouterLink>

          <RouterLink
            to="/login"
            class="button button-secondary"
          >
            Anmelden
          </RouterLink>
        </div>
      </div>

      <div class="hero-visual" aria-hidden="true">
        <div class="visual-icon">✦</div>
        <p>Meet. Explore. Connect.</p>
      </div>
    </section>

    <!-- Features -->
    <section class="features-section">
      <p class="eyebrow">WAS IST CAMPUSEVENT?</p>
      <h2>Mehr erleben. Gemeinsam.</h2>

      <div class="feature-grid">
        <article class="feature-card">
          <div class="feature-icon">📅</div>
          <h3>Events entdecken</h3>
          <p>
            Finde Veranstaltungen auf und
            rund um deinen Campus.
          </p>
        </article>

        <article class="feature-card">
          <div class="feature-icon">🎟️</div>
          <h3>Einfach teilnehmen</h3>
          <p>
            Melde dich für Veranstaltungen an
            und verwalte deine Teilnahmen.
          </p>
        </article>

        <article class="feature-card">
          <div class="feature-icon">🤝</div>
          <h3>Leute kennenlernen</h3>
          <p>
            Vernetze dich mit anderen Studierenden
            und entdecke neue Möglichkeiten.
          </p>
        </article>
      </div>
    </section>

    <!-- Bestehender API-Status aus CE-04 -->
    <section
      v-if="showDevelopmentStatus"
      class="development-section"
    >
      <h2>Entwicklungsstatus</h2>
      <ApiStatus />
    </section>

  </div>
</template>