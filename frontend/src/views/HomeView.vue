<script setup lang="ts">
import { useAuth } from '../composables/useAuth'

const { user } = useAuth()
</script>


<template>
  <div class="page-content">
    <!-- Hero -->
    <section class="hero">
      <p class="eyebrow">DEIN CAMPUS. DEINE EVENTS.</p>

      <h1>
        Entdecke das
        <span>Campusleben.</span>
      </h1>

      <!-- Beschreibung rechts auf Höhe der Überschrift -->
      <article class="feature-card hero-description">
        <h3>
          Finde spannende Veranstaltungen,
          neue Leute kennen und erlebe mehr
          außerhalb deiner Vorlesungen.
        </h3>
      </article>

      <div class="hero-actions">
        <RouterLink to="/events" class="button button-primary">
          Events entdecken
        </RouterLink>

        <RouterLink v-if="!user" to="/login" class="button button-secondary">
          Anmelden
        </RouterLink>
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
  </div>
</template>

<style scoped>
.page-content {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* Hero */

.hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
  grid-template-areas:
    "eyebrow ."
    "heading description"
    "actions .";
  column-gap: 64px;
  align-items: center;
  padding: 100px 0 110px;
}

.eyebrow {
  margin: 0 0 20px;
  color: #6d5dfc;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.12em;
}

.hero>.eyebrow {
  grid-area: eyebrow;
}

.hero h1 {
  grid-area: heading;
  margin: 0;
  color: #171a2b;
  font-size: clamp(2.7rem, 5vw, 4.5rem);
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.045em;
}

.hero h1 span {
  display: block;
  color: #6d5dfc;
}

/* Beschreibung rechts */

.hero-description {
  grid-area: description;
  align-self: center;
}

.hero-description h3 {
  line-height: 1.75;
}

/* Hero Buttons */

.hero-actions {
  grid-area: actions;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 36px;
}

.hero-actions .button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 12px 24px;
  border-radius: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
  transition:
    transform 0.2s ease,
    background-color 0.2s ease,
    box-shadow 0.2s ease;
}

.button-primary {
  background: #6d5dfc;
  color: #ffffff;
  border: 1px solid #6d5dfc;
}

.button-primary:hover {
  background: #5948e8;
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(109, 93, 252, 0.18);
}

.button-secondary {
  background: #ffffff;
  color: #25283b;
  border: 1px solid #dfe1e8;
}

.button-secondary:hover {
  background: #f7f7fb;
  transform: translateY(-2px);
}

/* Features */

.features-section {
  padding: 25px 0 100px;
}

.features-section .eyebrow {
  margin-bottom: 12px;
}

.features-section h2 {
  margin: 0 0 36px;
  color: #171a2b;
  font-size: clamp(1.8rem, 3vw, 2.5rem);
  font-weight: 750;
  letter-spacing: -0.035em;
  line-height: 1.2;
}

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
}

.feature-card {
  min-width: 0;
  padding: 32px;
  background: #ffffff;
  border: 1px solid #e9eaf0;
  border-radius: 16px;
  box-shadow: 0 5px 25px rgba(20, 25, 50, 0.035);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 10px 30px rgba(20, 25, 50, 0.075);
}

.feature-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  margin-bottom: 24px;
  background: #f2f0ff;
  border-radius: 12px;
  font-size: 1.55rem;
}

.feature-card h3 {
  margin: 0 0 12px;
  color: #202336;
  font-size: 1.15rem;
  font-weight: 700;
}

.feature-card p {
  margin: 0;
  color: #6a6e7e;
  font-size: 0.95rem;
  line-height: 1.75;
}

.hero-description h3 {
  margin: 0;
}

/* Tablet */

@media (max-width: 900px) {
  .hero {
    column-gap: 36px;
    padding: 75px 0 85px;
  }

  .feature-grid {
    gap: 16px;
  }

  .feature-card {
    padding: 24px;
  }
}

/* Mobile */

@media (max-width: 700px) {
  .page-content {
    padding: 0 20px;
  }

  .hero {
    grid-template-columns: 1fr;
    grid-template-areas:
      "eyebrow"
      "heading"
      "actions"
      "description";
    gap: 0;
    padding: 65px 0 75px;
  }

  .hero h1 {
    font-size: clamp(2.6rem, 9vw, 3.5rem);
  }

  .hero-actions {
    margin-top: 28px;
  }

  .hero-description {
    margin-top: 32px;
  }

  .features-section {
    padding: 10px 0 70px;
  }

  .feature-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .feature-card {
    padding: 28px;
  }
}

/* Kleine Smartphones */

@media (max-width: 400px) {
  .hero-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-actions .button {
    width: 100%;
  }
}
</style>
